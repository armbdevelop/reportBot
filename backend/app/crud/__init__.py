# backend/app/crud/__init__.py
from .shift_report import ShiftReportCRUD
from .daily_inventory import DailyInventoryCrud
from .report_on_good import ReportOnGoodCRUD
from .writeoff_transfer import WriteoffTransferCRUD
from .inventory_item import InventoryItemCRUD
from .daily_inventory_v2 import DailyInventoryV2CRUD

__all__ = [
    'ShiftReportCRUD',
    'DailyInventoryCrud',
    'ReportOnGoodCRUD',
    'WriteoffTransferCRUD',
    'InventoryItemCRUD',
    'DailyInventoryV2CRUD'
]