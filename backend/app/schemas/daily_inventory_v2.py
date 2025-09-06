from datetime import datetime, date, time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator


class InventoryDataEntry(BaseModel):
    """Запись данных инвентаризации"""
    item_id: int = Field(..., description="ID товара")
    quantity: int = Field(..., ge=0, description="Количество")

    class Config:
        json_schema_extra = {
            "example": {
                "item_id": 1,
                "quantity": 10
            }
        }


class DailyInventoryV2Create(BaseModel):
    """Схема для создания новой инвентаризации"""
    location: str = Field(..., min_length=1, max_length=255, description="Название локации")
    shift_type: str = Field(..., pattern=r"^(morning|night)$", description="Тип смены")
    cashier_name: str = Field(..., min_length=1, max_length=255, description="ФИО кассира")

    # ДОБАВИТЬ ЭТИ ПОЛЯ ДЛЯ ДАТЫ И ВРЕМЕНИ
    report_date: date = Field(..., description="Дата отчета")
    report_time: time = Field(..., description="Время отчета")

    inventory_data: List[InventoryDataEntry] = Field(..., description="Данные инвентаризации")

    @validator('report_time')
    def validate_time_format(cls, v):
        """Валидация времени"""
        if not isinstance(v, time):
            raise ValueError('Время должно быть в формате HH:MM')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Кафе Центральный",
                "shift_type": "morning",
                "cashier_name": "Иванов Иван Иванович",
                "report_date": "2025-06-20",
                "report_time": "14:30:00",
                "inventory_data": [
                    {"item_id": 1, "quantity": 10},
                    {"item_id": 2, "quantity": 5}
                ]
            }
        }


class DailyInventoryV2Response(BaseModel):
    """Ответ с данными инвентаризации"""
    id: int
    location: str
    shift_type: str
    cashier_name: str
    date: datetime
    inventory_data: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True