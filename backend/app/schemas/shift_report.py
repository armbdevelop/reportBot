# schemas/shift_report.py
from pydantic import BaseModel, Field, StringConstraints, validator, root_validator
from typing import List, Annotated, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class IncomeEntry(BaseModel):
    """Запись о приходе денег в кассу"""
    amount: Decimal = Field(
        ...,
        gt=0,
        description="Сумма прихода",
        example=500.50
    )
    comment: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Комментарий к приходу",
        example="Внесение от администратора"
    )

    class Config:
        json_encoders = {
            Decimal: float
        }
        json_schema_extra = {
            "example": {
                "amount": 500.50,
                "comment": "Внесение от администратора"
            }
        }


class ExpenseEntry(BaseModel):
    """Запись о расходе из кассы"""
    description: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Описание расхода",
        example="Покупка канцтоваров"
    )
    amount: Decimal = Field(
        ...,
        gt=0,
        description="Сумма расхода",
        example=125.75
    )

    class Config:
        json_encoders = {
            Decimal: float
        }
        json_schema_extra = {
            "example": {
                "description": "Покупка канцтоваров",
                "amount": 125.75
            }
        }


class ShiftReportCreate(BaseModel):
    """Схема для создания отчета завершения смены"""

    location: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Название локации",
        example="Кафе Центральный"
    )
    shift_type: Annotated[
        str,
        StringConstraints(pattern=r"^(morning|night)$")
    ] = Field(description="Тип смены", example="morning")


    cashier_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="ФИО кассира",
        example="Иванов Иван Иванович"
    )

    income_entries: List[IncomeEntry] = Field(
        default_factory=list,
        description="Список приходов денег (максимум 5)"
    )
    expense_entries: List[ExpenseEntry] = Field(
        default_factory=list,
        description="Список расходов денег (максимум 10)"
    )

    total_revenue: Decimal = Field(
        ...,
        description="Общая выручка из системы",
    )
    returns: Decimal = Field(
        default=0,
        description="Сумма возвратов",
    )
    acquiring: Decimal = Field(
        default=0,
        description="Эквайринг (оплата картами)",
    )
    qr_code: Decimal = Field(
        default=0,
        description="Оплата по QR коду",
    )
    online_app: Decimal = Field(
        default=0,
        description="Оплата через онлайн приложение",
        example=2000.00
    )
    yandex_food: Decimal = Field(
        default=0,
        description="Оплата через Яндекс Еда",
        example=1200.00
    )
    # НОВЫЕ ПОЛЯ
    yandex_food_no_system: Decimal = Field(
        default=0,
        description="Яндекс.Еда - не пришел заказ в систему",
        example=300.00
    )
    primehill: Decimal = Field(
        default=0,
        description="Primehill",
        example=500.00
    )

    fact_cash: Decimal = Field(
        ...,
        description="Фактическая сумма наличных в кассе",
        example=5100.50
    )

    comments: Optional[str] = Field(default=None)

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Кафе Центральный",
                "shift_type": "morning",
                "cashier_name": "Иванов Иван Иванович",
                "income_entries": [
                    {"amount": 500.50, "comment": "Внесение от администратора"},
                    {"amount": 200.00, "comment": "Сдача с предыдущей смены"}
                ],
                "expense_entries": [
                    {"description": "Покупка канцтоваров", "amount": 125.75},
                    {"description": "Такси для курьера", "amount": 300.00}
                ],
                "total_revenue": 15000.50,
                "returns": 200.00,
                "acquiring": 5000.00,
                "qr_code": 1500.00,
                "online_app": 2000.00,
                "yandex_food": 1200.00,
                "yandex_food_no_system": 300.00,
                "primehill": 500.00,
                "fact_cash": 5100.50
            }
        }


class ShiftReportResponse(BaseModel):
    """Ответ с данными созданного отчета смены"""

    id: int = Field(description="Уникальный идентификатор отчета")
    location: str = Field(description="Название локации")
    shift_type: str = Field(description="Тип смены")
    date: datetime = Field(description="Дата и время создания отчета")
    cashier_name: str = Field(description="ФИО кассира")

    # Расчетные поля
    total_income: int = Field(description="Общая сумма приходов")
    total_expenses: int = Field(description="Общая сумма расходов")
    total_acquiring: int = Field(description="Общая сумма безналичных платежей")
    calculated_amount: int = Field(description="Расчетная сумма наличных")
    surplus_shortage: int = Field(description="Излишек (+) / недостача (-)")
    fact_cash: int = Field(description="Фактическая сумма наличных")

    # Данные из системы
    total_revenue: int = Field(description="Общая выручка")
    returns: int = Field(description="Возвраты")
    acquiring: int = Field(description="Эквайринг")
    qr_code: int = Field(description="QR код")
    online_app: int = Field(description="Онлайн приложение")
    yandex_food: int = Field(description="Яндекс Еда")
    # НОВЫЕ ПОЛЯ
    yandex_food_no_system: int = Field(description="Яндекс.Еда - не пришел заказ в систему")
    primehill: int = Field(description="Primehill")

    # JSON поля из базы данных
    income_entries: List[Dict[str, Any]] = Field(
        default=[],
        description="Список приходов"
    )
    expense_entries: List[Dict[str, Any]] = Field(
        default=[],
        description="Список расходов"
    )

    photo_path: str = Field(description="Путь к фото отчета")
    status: str = Field(description="Статус отчета")
    created_at: datetime = Field(description="Время создания")

    comments: Optional[str] = Field(default=None, description="Комментарии к отчету")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "location": "Кафе Центральный",
                "shift_type": "morning",
                "date": "2025-05-28T10:30:00Z",
                "cashier_name": "Иванов Иван Иванович",
                "total_income": 700.50,
                "total_expenses": 425.75,
                "total_acquiring": 10500.00,
                "calculated_amount": 4774.75,
                "surplus_shortage": 325.75,
                "fact_cash": 5100.50,
                "total_revenue": 15000,
                "returns": 200,
                "acquiring": 5000,
                "qr_code": 1500,
                "online_app": 2000,
                "yandex_food": 1200,
                "yandex_food_no_system": 300,
                "primehill": 500,
                "income_entries": [
                    {"amount": 500.5, "comment": "Внесение от администратора"},
                    {"amount": 200.0, "comment": "Сдача с предыдущей смены"}
                ],
                "expense_entries": [
                    {"description": "Покупка канцтоваров", "amount": 125.75},
                    {"description": "Такси для курьера", "amount": 300.0}
                ],
                "photo_path": "./uploads/shift_reports/uuid-filename.jpg",
                "status": "draft",
                "created_at": "2025-05-28T10:30:00Z"
            }
        }