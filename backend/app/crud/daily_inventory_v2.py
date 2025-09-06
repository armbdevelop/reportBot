# backend/app/crud/daily_inventory_v2.py
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from zoneinfo import ZoneInfo
import asyncio

from app.models.daily_inventory_v2 import DailyInventoryV2
from app.models.inventory_item import InventoryItem
from app.schemas.daily_inventory_v2 import DailyInventoryV2Create
from app.services import TelegramService


class DailyInventoryV2CRUD:
    """CRUD операции для новой инвентаризации"""

    def __init__(self):
        try:
            self.telegram_service = TelegramService()
        except Exception as e:
            print(f"⚠️  Ошибка инициализации Telegram сервиса: {str(e)}")
            self.telegram_service = None

    async def create_inventory(
            self,
            db: AsyncSession,
            inventory_data: DailyInventoryV2Create
    ) -> DailyInventoryV2:
        """Создать новую инвентаризацию с отправкой в Telegram"""
        try:
            # Проверяем, что все товары существуют
            item_ids = [entry.item_id for entry in inventory_data.inventory_data]
            if item_ids:
                result = await db.execute(
                    select(InventoryItem.id)
                    .where(
                        InventoryItem.id.in_(item_ids),
                        InventoryItem.is_active == True
                    )
                )
                existing_ids = {row[0] for row in result.fetchall()}
                missing_ids = set(item_ids) - existing_ids

                if missing_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Товары с ID {list(missing_ids)} не найдены или неактивны"
                    )

            # Преобразуем данные в JSON формат
            inventory_json = [
                {"item_id": entry.item_id, "quantity": entry.quantity}
                for entry in inventory_data.inventory_data
            ]


            # Объединяем дату и время от пользователя
            date = datetime.combine(
                inventory_data.report_date,
                inventory_data.report_time
            )

            db_inventory = DailyInventoryV2(
                location=inventory_data.location,
                shift_type=inventory_data.shift_type,
                cashier_name=inventory_data.cashier_name,
                date=date,
                inventory_data=inventory_json
            )

            db.add(db_inventory)
            await db.commit()
            await db.refresh(db_inventory)

            print(f"✅ Инвентаризация v2 создана с ID: {db_inventory.id}")

            # Запускаем отправку в Telegram в фоне
            if self.telegram_service:
                asyncio.create_task(self._send_to_telegram_background(db_inventory.id))

            return db_inventory

        except HTTPException:
            await db.rollback()
            raise
        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка создания инвентаризации: {str(e)}"
            )

    async def _send_to_telegram_background(self, inventory_id: int):
        """
        Фоновая отправка отчета инвентаризации v2 в Telegram.
        """
        from ..core import db_helper

        try:
            # Создаем новую сессию БД для фоновой задачи
            async with db_helper.session_factory() as db_session:
                try:
                    # Получаем детальную информацию об инвентаризации
                    detailed_inventory = await self.get_inventory_with_items(db_session, inventory_id)

                    if not detailed_inventory:
                        print(f"⚠️  Инвентаризация v2 с ID {inventory_id} не найдена для отправки в Telegram")
                        return

                    # Отправляем в Telegram (с таймаутом)
                    telegram_success = await asyncio.wait_for(
                        self.telegram_service.send_daily_inventory_v2_report(detailed_inventory),
                        timeout=30  # 30 секунд таймаут
                    )

                    if telegram_success:
                        print(
                            f"✅ Инвентаризация v2 ID {inventory_id} отправлена в Telegram для локации: {detailed_inventory['location']}")
                    else:
                        print(
                            f"⚠️  Инвентаризация v2 ID {inventory_id} создана, но не отправлена в Telegram для локации: {detailed_inventory['location']}")

                except asyncio.TimeoutError:
                    print(f"⏰ Таймаут при отправке инвентаризации v2 ID {inventory_id} в Telegram")
                except Exception as telegram_error:
                    print(
                        f"⚠️  Ошибка отправки инвентаризации v2 ID {inventory_id} в Telegram: {str(telegram_error)}")

        except Exception as e:
            print(
                f"⚠️  Критическая ошибка в фоновой отправке Telegram для инвентаризации v2 ID {inventory_id}: {str(e)}"
            )

    async def get_inventory_with_items(
            self,
            db: AsyncSession,
            inventory_id: int
    ) -> Optional[Dict[str, Any]]:
        """Получить инвентаризацию с детальной информацией о товарах"""
        try:
            # Получаем инвентаризацию
            result = await db.execute(
                select(DailyInventoryV2).where(DailyInventoryV2.id == inventory_id)
            )
            inventory = result.scalar_one_or_none()

            if not inventory:
                return None

            # Получаем информацию о товарах
            if inventory.inventory_data:
                item_ids = [entry["item_id"] for entry in inventory.inventory_data]
                items_result = await db.execute(
                    select(InventoryItem).where(InventoryItem.id.in_(item_ids))
                )
                items = {item.id: item for item in items_result.scalars().all()}

                # Объединяем данные
                detailed_data = []
                for entry in inventory.inventory_data:
                    item_id = entry["item_id"]
                    item = items.get(item_id)
                    if item:
                        detailed_data.append({
                            "item_id": item_id,
                            "item_name": item.name,
                            "item_unit": item.unit,
                            "quantity": entry["quantity"]
                        })
                    else:
                        detailed_data.append({
                            "item_id": item_id,
                            "item_name": "Товар не найден",
                            "item_unit": "шт",
                            "quantity": entry["quantity"]
                        })
            else:
                detailed_data = []

            return {
                "id": inventory.id,
                "location": inventory.location,
                "shift_type": inventory.shift_type,
                "cashier_name": inventory.cashier_name,
                "date": inventory.date,
                "inventory_data": detailed_data,
                "created_at": inventory.created_at,
                "updated_at": inventory.updated_at
            }

        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка получения инвентаризации: {str(e)}"
            )

    async def get_inventory_list(
            self,
            db: AsyncSession,
            location: Optional[str] = None,
            shift_type: Optional[str] = None,
            skip: int = 0,
            limit: int = 100
    ) -> tuple[List[DailyInventoryV2], int]:
        """Получить список инвентаризаций с фильтрацией"""
        try:
            # Базовый запрос
            query = select(DailyInventoryV2)
            count_query = select(DailyInventoryV2).count()

            # Применяем фильтры
            if location:
                query = query.where(DailyInventoryV2.location == location)
                count_query = count_query.where(DailyInventoryV2.location == location)

            if shift_type:
                query = query.where(DailyInventoryV2.shift_type == shift_type)
                count_query = count_query.where(DailyInventoryV2.shift_type == shift_type)

            # Сортировка и пагинация
            query = query.order_by(DailyInventoryV2.date.desc())
            query = query.offset(skip).limit(limit)

            # Выполняем запросы
            result = await db.execute(query)
            count_result = await db.execute(count_query)

            inventories = result.scalars().all()
            total = count_result.scalar()

            return list(inventories), total

        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка получения списка инвентаризаций: {str(e)}"
            )

    async def delete_inventory(self, db: AsyncSession, inventory_id: int) -> bool:
        """Удалить инвентаризацию"""
        try:
            result = await db.execute(
                select(DailyInventoryV2).where(DailyInventoryV2.id == inventory_id)
            )
            inventory = result.scalar_one_or_none()

            if not inventory:
                return False

            await db.delete(inventory)
            await db.commit()

            print(f"✅ Инвентаризация v2 удалена: ID {inventory_id}")
            return True

        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка удаления инвентаризации: {str(e)}"
            )