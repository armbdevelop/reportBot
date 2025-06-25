from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from app.schemas import DailyInventoryCreate
from app.models import DailyInventory
from app.services import TelegramService
import asyncio
import datetime
from zoneinfo import ZoneInfo

class DailyInventoryCrud:
    def __init__(self):
        try:
            self.telegram_service = TelegramService()
        except Exception as e:
            print(f"⚠️  Ошибка инициализации Telegram сервиса: {str(e)}")
            self.telegram_service = None

    async def create_daily_inventory(
            self,
            db: AsyncSession,
            daily_data: DailyInventoryCreate,
    ) -> DailyInventory:
        """
        Создает отчет ежедневной инвентаризации.
        Telegram отправка происходит асинхронно.
        """
        try:
            date = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=6)))


            # Создаем запись в БД
            db_daily_inventory = DailyInventory(
                location=daily_data.location,
                shift_type=daily_data.shift_type,
                date=date,
                cashier_name=daily_data.cashier_name,
                il_primo_steklo=daily_data.il_primo_steklo,
                voda_gornaya=daily_data.voda_gornaya,
                dobri_sok_pet=daily_data.dobri_sok_pet,
                kuragovi_kompot=daily_data.kuragovi_kompot,
                napitki_jb=daily_data.napitki_jb,
                energetiky=daily_data.energetiky,
                kold_bru=daily_data.kold_bru,
                kinza_napitky=daily_data.kinza_napitky,
                palli=daily_data.palli,
                barbeku_dip=daily_data.barbeku_dip,
                bulka_na_shaurmu=daily_data.bulka_na_shaurmu,
                lavash=daily_data.lavash,
                lepeshki=daily_data.lepeshki,
                ketchup_dip=daily_data.ketchup_dip,
                sirny_sous_dip=daily_data.sirny_sous_dip,
                kuriza_jareny=daily_data.kuriza_jareny,
                kuriza_siraya=daily_data.kuriza_siraya,
            )

            db.add(db_daily_inventory)
            await db.commit()
            await db.refresh(db_daily_inventory)

            print(f"✅ Отчет инвентаризации создан в БД с ID: {db_daily_inventory.id}")

            # Запускаем отправку в Telegram в фоне
            if self.telegram_service:
                asyncio.create_task(self._send_to_telegram_background(db_daily_inventory.id))

            return db_daily_inventory

        except SQLAlchemyError as e:
            print(f"❌ Ошибка SQLAlchemy при создании отчета инвентаризации: {str(e)}")
            await db.rollback()
            raise e
        except Exception as e:
            print(f"❌ Общая ошибка при создании отчета инвентаризации: {str(e)}")
            await db.rollback()
            raise e

    async def _send_to_telegram_background(self, inventory_id: int):
        """
        Фоновая отправка отчета инвентаризации в Telegram.
        """
        from ..core import db_helper
        from sqlalchemy import select

        try:
            # Создаем новую сессию БД для фоновой задачи
            async with db_helper.session_factory() as db_session:
                try:
                    # Получаем отчет из БД
                    result = await db_session.execute(
                        select(DailyInventory).where(DailyInventory.id == inventory_id)
                    )
                    db_inventory = result.scalar_one_or_none()

                    if not db_inventory:
                        print(f"⚠️  Отчет инвентаризации с ID {inventory_id} не найден для отправки в Telegram")
                        return

                    # Подготавливаем данные для отправки
                    report_dict = {
                        'location': db_inventory.location,
                        'cashier_name': db_inventory.cashier_name,
                        'shift_type': db_inventory.shift_type,
                        'date': db_inventory.date,
                        'il_primo_steklo': db_inventory.il_primo_steklo,
                        'voda_gornaya': db_inventory.voda_gornaya,
                        'dobri_sok_pet': db_inventory.dobri_sok_pet,
                        'kuragovi_kompot': db_inventory.kuragovi_kompot,
                        'napitki_jb': db_inventory.napitki_jb,
                        'energetiky': db_inventory.energetiky,
                        'kold_bru': db_inventory.kold_bru,
                        'kinza_napitky': db_inventory.kinza_napitky,
                        'palli': db_inventory.palli,
                        'barbeku_dip': db_inventory.barbeku_dip,
                        'bulka_na_shaurmu': db_inventory.bulka_na_shaurmu,
                        'lavash': db_inventory.lavash,
                        'lepeshki': db_inventory.lepeshki,
                        'ketchup_dip': db_inventory.ketchup_dip,
                        'sirny_sous_dip': db_inventory.sirny_sous_dip,
                        'kuriza_jareny': db_inventory.kuriza_jareny,
                        'kuriza_siraya': db_inventory.kuriza_siraya,
                    }

                    # Отправляем в Telegram (с таймаутом)
                    telegram_success = await asyncio.wait_for(
                        self.telegram_service.send_daily_inventory_report(report_dict),
                        timeout=30  # 30 секунд таймаут
                    )

                    if telegram_success:
                        print(
                            f"✅ Отчет инвентаризации ID {inventory_id} отправлен в Telegram для локации: {db_inventory.location}")
                    else:
                        print(
                            f"⚠️  Отчет инвентаризации ID {inventory_id} создан, но не отправлен в Telegram для локации: {db_inventory.location}")

                except asyncio.TimeoutError:
                    print(f"⏰ Таймаут при отправке отчета инвентаризации ID {inventory_id} в Telegram")
                except Exception as telegram_error:
                    print(
                        f"⚠️  Ошибка отправки отчета инвентаризации ID {inventory_id} в Telegram: {str(telegram_error)}")

        except Exception as e:
            print(
                f"⚠️  Критическая ошибка в фоновой отправке Telegram для отчета инвентаризации ID {inventory_id}: {str(e)}")