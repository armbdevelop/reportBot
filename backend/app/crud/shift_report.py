from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from app.models import ShiftReport
from app.schemas import ShiftReportCreate
from app.services import ReportCalculator, TelegramService
from app.services import FileService
from typing import Optional
import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

class ShiftReportCRUD:
    def __init__(self):
        self.calculator = ReportCalculator()
        self.file_service = FileService()
        # Инициализация TelegramService в try-catch
        try:
            self.telegram_service = TelegramService()
        except Exception as e:
            print(f"⚠️  Ошибка инициализации Telegram сервиса: {str(e)}")
            self.telegram_service = None

    async def create_shift_report(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile,
            receipt_photo: Optional[UploadFile] = None
    ) -> ShiftReport:
        """
        Создает новый отчет завершения смены с расчетами.
        Telegram отправка происходит асинхронно и не влияет на создание записи.
        """
        # Создаем отчет в базе данных
        db_report = await self._create_report_in_db_safe(db, report_data, photo, receipt_photo)

        # Запускаем отправку в Telegram в фоне (не ждем результата)
        if self.telegram_service and db_report:
            asyncio.create_task(self._send_to_telegram_background(db_report.id))

        return db_report

    async def _create_report_in_db_safe(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile,
            receipt_photo: Optional[UploadFile] = None
    ) -> ShiftReport:
        """
        Безопасно создает отчет в базе данных с правильной обработкой транзакций.
        """
        db_report = None

        try:

            # Используем переданную дату смены или текущее время по МСК
            if report_data.shift_date:
                # Если дата передана, используем её и добавляем timezone МСК
                date = report_data.shift_date.replace(tzinfo=ZoneInfo("Europe/Moscow"))
            else:
                # Иначе используем текущее время по МСК
                date = datetime.now(ZoneInfo("UTC")).astimezone(ZoneInfo("Europe/Moscow"))

            # Сохраняем фото
            photo_path = self.file_service.save_shift_report_photo(photo)

            # НОВОЕ: Сохраняем фото чека, если оно предоставлено
            receipt_photo_path = None
            if receipt_photo:
                receipt_photo_path = self.file_service.save_shift_report_photo(receipt_photo)

            # Рассчитываем сверку (ОБНОВЛЕНО: добавлены новые поля)
            calculations = self.calculator.calculate_shift_report(
                total_revenue=report_data.total_revenue,
                returns=report_data.returns,
                income_entries=report_data.income_entries,
                expense_entries=report_data.expense_entries,
                acquiring=report_data.acquiring,
                qr_code=report_data.qr_code,
                online_app=report_data.online_app,
                yandex_food=report_data.yandex_food,
                yandex_food_no_system=report_data.yandex_food_no_system,  # НОВОЕ ПОЛЕ
                primehill=report_data.primehill,  # НОВОЕ ПОЛЕ
                fact_cash=report_data.fact_cash
            )

            # Подготавливаем данные для JSON полей
            income_entries_dict = []
            for entry in report_data.income_entries:
                income_entries_dict.append({
                    'amount': float(entry.amount),
                    'comment': entry.comment
                })

            expense_entries_dict = []
            for entry in report_data.expense_entries:
                expense_entries_dict.append({
                    'description': entry.description,
                    'amount': float(entry.amount)
                })

            # Создаем отчет (ОБНОВЛЕНО: добавлены новые поля)
            db_report = ShiftReport(
                location=report_data.location,
                shift_type=report_data.shift_type,
                date=date,
                cashier_name=report_data.cashier_name,
                income_entries=income_entries_dict,
                expense_entries=expense_entries_dict,
                total_income=calculations["total_income"],
                total_expenses=calculations["total_expenses"],
                total_revenue=report_data.total_revenue,
                returns=report_data.returns,
                acquiring=report_data.acquiring,
                qr_code=report_data.qr_code,
                online_app=report_data.online_app,
                yandex_food=report_data.yandex_food,
                yandex_food_no_system=report_data.yandex_food_no_system,  # НОВОЕ ПОЛЕ
                primehill=report_data.primehill,  # НОВОЕ ПОЛЕ
                fact_cash=report_data.fact_cash,
                total_acquiring=calculations["total_acquiring"],
                calculated_amount=calculations["calculated_amount"],
                surplus_shortage=calculations["surplus_shortage"],
                photo_path=photo_path,
                receipt_photo_path=receipt_photo_path,  # НОВОЕ ПОЛЕ
                comments=report_data.comments,
                status="draft"
            )

            # Сохраняем отчет в базу данных
            db.add(db_report)
            await db.commit()
            await db.refresh(db_report)

            print(f"✅ Отчет смены создан в БД с ID: {db_report.id}")
            return db_report

        except SQLAlchemyError as e:
            print(f"❌ Ошибка SQLAlchemy при создании отчета: {str(e)}")
            await db.rollback()
            raise e
        except Exception as e:
            print(f"❌ Общая ошибка при создании отчета: {str(e)}")
            await db.rollback()
            raise e

    async def _send_to_telegram_background(self, report_id: int):
        """
        Фоновая отправка отчета в Telegram с использованием новой сессии БД.
        """
        from ..core import db_helper

        try:
            # Создаем новую сессию БД для фоновой задачи
            async with db_helper.session_factory() as db_session:
                try:
                    # Получаем отчет из БД
                    result = await db_session.execute(
                        select(ShiftReport).where(ShiftReport.id == report_id)
                    )
                    db_report = result.scalar_one_or_none()

                    if not db_report:
                        print(f"⚠️  Отчет с ID {report_id} не найден для отправки в Telegram")
                        return

                    # Подготавливаем данные для отправки (ОБНОВЛЕНО: добавлены новые поля)
                    report_dict = {
                        'location': db_report.location,
                        'cashier_name': db_report.cashier_name,
                        'shift_type': db_report.shift_type,
                        'date': db_report.date,
                        'total_revenue': float(db_report.total_revenue),
                        'returns': float(db_report.returns),
                        'acquiring': float(db_report.acquiring),
                        'qr_code': float(db_report.qr_code),
                        'online_app': float(db_report.online_app),
                        'yandex_food': float(db_report.yandex_food),
                        'yandex_food_no_system': float(db_report.yandex_food_no_system),  # НОВОЕ ПОЛЕ
                        'primehill': float(db_report.primehill),  # НОВОЕ ПОЛЕ
                        'total_acquiring': float(db_report.total_acquiring),
                        'income_entries': db_report.income_entries,
                        'total_income': float(db_report.total_income),
                        'expense_entries': db_report.expense_entries,
                        'total_expenses': float(db_report.total_expenses),
                        'calculated_amount': float(db_report.calculated_amount),
                        'fact_cash': float(db_report.fact_cash),
                        'surplus_shortage': float(db_report.surplus_shortage),
                        "comments": db_report.comments
                    }

                    # Отправляем в Telegram (с таймаутом)
                    telegram_success = await asyncio.wait_for(
                        self.telegram_service.send_shift_report(
                            report_dict,
                            db_report.photo_path,
                            db_report.receipt_photo_path  # НОВОЕ: передаем фото чека
                        ),
                        timeout=30  # 30 секунд таймаут
                    )

                    # Обновляем статус в новой транзакции
                    if telegram_success:
                        db_report.status = "sent"
                        await db_session.commit()
                        print(f"✅ Отчет смены ID {report_id} отправлен в Telegram для локации: {db_report.location}")
                    else:
                        print(
                            f"⚠️  Отчет смены ID {report_id} создан, но не отправлен в Telegram для локации: {db_report.location}")

                except asyncio.TimeoutError:
                    print(f"⏰ Таймаут при отправке отчета ID {report_id} в Telegram")
                except Exception as telegram_error:
                    print(f"⚠️  Ошибка отправки отчета ID {report_id} в Telegram: {str(telegram_error)}")

        except Exception as e:
            print(f"⚠️  Критическая ошибка в фоновой отправке Telegram для отчета ID {report_id}: {str(e)}")

    async def get_shift_report(
            self,
            db: AsyncSession,
            report_id: int
    ) -> Optional[ShiftReport]:
        """
        Получает отчет по ID.
        """
        try:
            result = await db.execute(
                select(ShiftReport).where(ShiftReport.id == report_id)
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            await db.rollback()
            raise e

    async def update_status(
            self,
            db: AsyncSession,
            report_id: int,
            status: str
    ) -> Optional[ShiftReport]:
        """
        Обновляет статус отчета.
        """
        try:
            result = await db.execute(
                select(ShiftReport).where(ShiftReport.id == report_id)
            )
            report = result.scalar_one_or_none()

            if report:
                report.status = status
                await db.commit()
                await db.refresh(report)

            return report
        except SQLAlchemyError as e:
            await db.rollback()
            raise e

    async def get(self, db: AsyncSession, id: int) -> Optional[ShiftReport]:
        """Получение отчета по ID"""
        try:
            stmt = select(ShiftReport).where(ShiftReport.id == id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            print(f"❌ Ошибка получения отчета {id}: {str(e)}")
            return None

    async def remove(self, db: AsyncSession, id: int) -> bool:
        """Удаление отчета по ID"""
        try:
            stmt = select(ShiftReport).where(ShiftReport.id == id)
            result = await db.execute(stmt)
            report = result.scalar_one_or_none()

            if report:
                await db.delete(report)
                return True
            return False
        except Exception as e:
            print(f"❌ Ошибка удаления отчета {id}: {str(e)}")
            return False

