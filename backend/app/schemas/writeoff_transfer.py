from datetime import datetime, date, time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator


class WriteoffEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Наименование товара", example="Курица жареная")
    weight: int = Field(..., gt=0, description="Вес/количество", example=12)
    unit: str = Field(..., description="Единица измерения", example="кг")
    reason: str = Field(..., min_length=1, max_length=255, description="Причина порчи", example="Пересушена")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Курица жареная",
                "weight": 2.0,
                "unit": "кг",
                "reason": "Пересушена"
            }
        }


class TransferEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Наименование товара", example="Вода Горная")
    weight: int= Field(..., gt=0, description="Вес/количество", example=12)
    unit: str = Field(..., description="Единица измерения", example="кг")
    reason: str = Field(..., min_length=1, max_length=255, description="Причина перемещения",
                        example="На точку Гайдара")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Вода Горная",
                "weight": 12.0,
                "unit": "кг",
                "reason": "На точку Гайдара"
            }
        }


class WriteoffTransferCreate(BaseModel):
    """Схема для создания акта списания/перемещения"""
    location: str = Field(
        ...,
        description="Название локации",
        example="Абдулхакима Исмаилова 51"
    )
    shift_type: str = Field(description="Тип смены")
    cashier_name: str = Field(description="ФИО кассира")

    report_date: Optional[date] = Field(None, description="Дата отчета (опционально)")
    report_time: Optional[time] = Field(None, description="Время отчета (опционально)")


    writeoffs: List[WriteoffEntry] = Field(
        default_factory=list,
        description="Список списаний (максимум 10)"
    )

    transfers: List[TransferEntry] = Field(
        default_factory=list,
        description="Список перемещений (максимум 10)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Абдулхакима Исмаилова 51",
                "report_date": "2025-05-24",
                "writeoffs": [
                    {"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"},
                    {"name": "Соус сырный", "weight": 1.0, "unit": "кг", "reason": "Истёк срок годности"}
                ],
                "transfers": [
                    {"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"},
                    {"name": "Лаваш", "weight": 6.0, "unit": "кг", "reason": "На точку Гагарина"}
                ]
            }
        }

    @validator('report_time')
    def validate_time_format(cls, v):
        """Валидация времени"""
        if v is not None and not isinstance(v, time):
            raise ValueError('Время должно быть в формате HH:MM')
        return v


class WriteoffTransferResponse(BaseModel):
    """Ответ с данными созданного акта списания/перемещения"""
    id: int = Field(description="Уникальный идентификатор отчета")
    location: str = Field(description="Название локации")
    shift_type: str = Field(description="Тип смены")
    cashier_name: str = Field(description="ФИО кассира")
    created_date: datetime = Field(description="Дата и время создания")

    writeoffs: List[Dict[str, Any]] = Field(description="Список списаний")
    transfers: List[Dict[str, Any]] = Field(description="Список перемещений")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "location": "Абдулхакима Исмаилова 51",
                "report_date": "2025-05-24",
                "created_date": "2025-05-24T10:30:00Z",
                "writeoffs": [
                    {"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"},
                    {"name": "Соус сырный", "weight": 1.0, "unit": "кг", "reason": "Истёк срок годности"}
                ],
                "transfers": [
                    {"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"},
                    {"name": "Лаваш", "weight": 6.0, "unit": "кг", "reason": "На точку Гагарина"}
                ]
            }
        }