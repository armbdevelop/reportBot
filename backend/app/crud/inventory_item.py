from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException, status
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_item import InventoryItem
from app.schemas.inventory_item import InventoryItemCreate, InventoryItemUpdate


class InventoryItemCRUD:
    """CRUD операции для товаров инвентаризации"""

    async def create_item(
            self,
            db: AsyncSession,
            item_data: InventoryItemCreate
    ) -> InventoryItem:
        """Создать новый товар"""
        try:
            db_item = InventoryItem(
                name=item_data.name,
                unit=item_data.unit,
                is_active=item_data.is_active
            )

            db.add(db_item)
            await db.commit()
            await db.refresh(db_item)

            print(f"✅ Товар создан: {db_item.name}")
            return db_item

        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Товар с названием '{item_data.name}' уже существует"
            )
        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка создания товара: {str(e)}"
            )

    async def get_item(self, db: AsyncSession, item_id: int) -> Optional[InventoryItem]:
        """Получить товар по ID"""
        try:
            result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка получения товара: {str(e)}"
            )

    async def get_items(
            self,
            db: AsyncSession,
            is_active: Optional[bool] = None,
            skip: int = 0,
            limit: int = 100
    ) -> tuple[List[InventoryItem], int]:
        """Получить список товаров с фильтрацией"""
        try:
            # Базовый запрос
            query = select(InventoryItem)
            count_query = select(func.count(InventoryItem.id))

            # Применяем фильтры
            if is_active is not None:
                query = query.where(InventoryItem.is_active == is_active)
                count_query = count_query.where(InventoryItem.is_active == is_active)

            # Сортировка и пагинация
            query = query.order_by(InventoryItem.name)
            query = query.offset(skip).limit(limit)

            # Выполняем запросы
            result = await db.execute(query)
            count_result = await db.execute(count_query)

            items = result.scalars().all()
            total = count_result.scalar()

            return list(items), total

        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка получения списка товаров: {str(e)}"
            )

    async def update_item(
            self,
            db: AsyncSession,
            item_id: int,
            item_data: InventoryItemUpdate
    ) -> Optional[InventoryItem]:
        """Обновить товар"""
        try:
            result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            db_item = result.scalar_one_or_none()

            if not db_item:
                return None

            # Обновляем только переданные поля
            update_data = item_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_item, field, value)

            db_item.updated_at = datetime.utcnow()
            await db.commit()
            await db.refresh(db_item)

            print(f"✅ Товар обновлен: {db_item.name}")
            return db_item

        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Товар с таким названием уже существует"
            )
        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка обновления товара: {str(e)}"
            )

    async def delete_item(self, db: AsyncSession, item_id: int) -> bool:
        """Удалить товар (мягкое удаление - деактивация)"""
        try:
            result = await db.execute(
                select(InventoryItem).where(InventoryItem.id == item_id)
            )
            db_item = result.scalar_one_or_none()

            if not db_item:
                return False

            # Мягкое удаление - деактивируем товар
            db_item.is_active = False
            db_item.updated_at = datetime.utcnow()

            await db.commit()

            print(f"✅ Товар деактивирован: {db_item.name}")
            return True

        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка удаления товара: {str(e)}"
            )


# Экземпляр для использования
inventory_crud = InventoryItemCRUD()