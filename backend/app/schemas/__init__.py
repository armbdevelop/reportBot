# backend/app/schemas/__init__.py
from .shift_report import ShiftReportCreate, ShiftReportResponse, IncomeEntry, ExpenseEntry
from .daily_inventory import DailyInventoryCreate, DailyInventoryResponse
from .report_on_goods import ReportOnGoodsCreate, ReportOnGoodsResponse, KuxnyaJson, BarJson, UpakovkyJson
from .writeoff_transfer import WriteoffTransferCreate, WriteoffTransferResponse, WriteoffEntry, TransferEntry
from .telegram import TelegramUpdate, TelegramMessage, TelegramUser, TelegramChat
from .inventory_item import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemList
)
from .daily_inventory_v2 import (
    DailyInventoryV2Create,
    DailyInventoryV2Response,
    InventoryDataEntry
)

__all__ = [
    'ShiftReportCreate',
    'ShiftReportResponse',
    'IncomeEntry',
    'ExpenseEntry',
    'DailyInventoryCreate',
    'DailyInventoryResponse',
    'ReportOnGoodsCreate',
    'ReportOnGoodsResponse',
    'KuxnyaJson',
    'BarJson',
    'UpakovkyJson',
    'WriteoffTransferCreate',
    'WriteoffTransferResponse',
    'WriteoffEntry',
    'TransferEntry',
    'TelegramUpdate',
    'TelegramMessage',
    'TelegramUser',
    'TelegramChat',
    'InventoryItemCreate',
    'InventoryItemUpdate',
    'InventoryItemResponse',
    'InventoryItemList',
    'DailyInventoryV2Create',
    'DailyInventoryV2Response',
    'InventoryDataEntry'
]