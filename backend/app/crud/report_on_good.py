from typing import Dict, List, Any, Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas import ReportOnGoodsCreate
from app.models import ReportOnGoods
from app.services import TelegramService
from datetime import datetime

class ReportOnGoodCRUD:
    def __init__(self):
        self.telegram_service = TelegramService()

    async def create_report_on_good(
            self,
            db: AsyncSession,
            report_data: ReportOnGoodsCreate,
            photos: List[Dict[str, Any]]
    ):
        kuxnya_dict = []
        for kux in report_data.kuxnya:
            kuxnya_dict.append({
                'name': kux.name,
                'count': int(kux.count),
                'unit': kux.unit,
            })

        bar_dict = []
        for bar in report_data.bar:
            bar_dict.append({
                'name': bar.name,
                'count': int(bar.count),
                'unit': bar.unit,
            })

        upakovki_dict = []
        for upakovki in report_data.upakovki:
            upakovki_dict.append({
                'name': upakovki.name,
                'count': int(upakovki.count),
                'unit': upakovki.unit,
            })

        db_report = ReportOnGoods(
            location=report_data.location,
            shift_type=report_data.shift_type,
            cashier_name=report_data.cashier_name,
            kuxnya=kuxnya_dict,
            bar=bar_dict,
            upakovki_xoz=upakovki_dict,
        )

        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)

        # Отправляем в Telegram
        try:
            report_dict = {
                'location': db_report.location,
                'cashier_name': db_report.cashier_name,
                'shift_type': db_report.shift_type,
                'kuxnya': db_report.kuxnya,
                'bar': db_report.bar,
                'upakovki_xoz': db_report.upakovki_xoz,
            }

            await self.telegram_service.send_goods_report(report_dict, photos=photos)

        except Exception as e:
            print(f"Ошибка отправки отчета товаров в Telegram: {str(e)}")

        return db_report

    async def send_photo(self, location: str, photos: List[Dict[str, Any]]):
        try:
            return await self.telegram_service.send_photos_to_location(location=location, photos=photos)
        except Exception as e:
            raise HTTPException(status_code=401, detail=str(e))

    async def get(self, db: AsyncSession, id: int) -> Optional[ReportOnGoods]:
        """Получение отчета приема товара по ID"""
        try:
            stmt = select(ReportOnGoods).where(ReportOnGoods.id == id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            print(f"❌ Ошибка получения отчета приема товара {id}: {str(e)}")
            return None

    async def remove(self, db: AsyncSession, id: int) -> bool:
        """Удаление отчета приема товара по ID"""
        try:
            stmt = select(ReportOnGoods).where(ReportOnGoods.id == id)
            result = await db.execute(stmt)
            report = result.scalar_one_or_none()
            
            if report:
                await db.delete(report)
                return True
            return False
        except Exception as e:
            print(f"❌ Ошибка удаления отчета приема товара {id}: {str(e)}")
            return False
