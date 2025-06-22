# backend/app/api/__init__.py
from .shift_reports import router as shift_reports_router
from .daily_inventories import router as daily_inventories_router
from .report_on_goods import router as report_on_goods_router
from .writeoff_transfer import router as writeoff_transfer_router
from .telegram_webhook import router as telegram_webhook_router
from .inventory_management import router as inventory_management_router
from .daily_inventory_v2 import router as daily_inventory_v2_router
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(shift_reports_router, prefix="/shift-reports", tags=["Shift Reports"])
api_router.include_router(daily_inventories_router, prefix="/daily_inventory", tags=["daily_inventory"])
api_router.include_router(report_on_goods_router, prefix="/report-on-goods", tags=["report-on-goods"])
api_router.include_router(writeoff_transfer_router, prefix="/writeoff-transfer", tags=["writeoff-transfer"])
api_router.include_router(telegram_webhook_router, prefix="/telegram", tags=["Telegram"])
api_router.include_router(inventory_management_router, prefix="/inventory-management", tags=["Inventory Management"])
api_router.include_router(daily_inventory_v2_router, prefix="/daily-inventory-v2", tags=["Daily Inventory V2"])