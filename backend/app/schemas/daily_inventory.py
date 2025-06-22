from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class DailyInventoryCreate(BaseModel):
    """Схема для создания ежедневного инвентаря"""
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

    # НАПИТКИ
    il_primo_steklo: int = Field(..., ge=0, description="Количество Il Primo (стекло)")
    voda_gornaya: int = Field(..., ge=0, description="Количество горной воды")
    dobri_sok_pet: int = Field(..., ge=0, description="Количество сока Добрый (ПЭТ)")
    kuragovi_kompot: int = Field(..., ge=0, description="Количество кураговый компот")
    napitki_jb: int = Field(..., ge=0, description="Количество напитков JB")
    energetiky: int = Field(..., ge=0, description="Количество энергетиков")
    kold_bru: int = Field(..., ge=0, description="Количество колд брю")
    kinza_napitky: int = Field(..., ge=0, description="Количество напитков Кинза")

    # ЕДА И ИНГРЕДИЕНТЫ
    palli: int = Field(..., ge=0, description="Количество палли (лепешки)")
    barbeku_dip: int = Field(..., ge=0, description="Количество барбекю дипа")
    bulka_na_shaurmu: int = Field(..., ge=0, description="Количество булок для шаурмы")
    lavash: int = Field(..., ge=0, description="Количество лаваша"),
    lepeshki: int = Field(..., ge=0, description="Количество лепешек"),
    ketchup_dip: int = Field(..., ge=0, description="Количество кетчуп дипа")
    sirny_sous_dip: int = Field(..., ge=0, description="Количество сырного соуса дип")
    kuriza_jareny: int = Field(..., ge=0, description="Количество жареной курицы")
    kuriza_siraya: int = Field(..., ge=0, description="Количество сырой курицы")

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Кафе Центральный",
                "shift_type": "morning",
                "cashier_name": "Иванов Иван Иванович",
                "il_primo_steklo": 10,
                "voda_gornaya": 15,
                "dobri_sok_pet": 8,
                "kuragovi_kompot": 5,
                "napitki_jb": 12,
                "energetiky": 6,
                "kold_bru": 4,
                "kinza_napitky": 7,
                "palli": 25,
                "barbeku_dip": 3,
                "bulka_na_shaurmu": 20,
                "lavash": 15,
                "lepeshki": 10,
                "ketchup_dip": 5,
                "sirny_sous_dip": 4,
                "kuriza_jareny": 10,
                "kuriza_siraya": 8
            }
        }


class DailyInventoryResponse(BaseModel):
    """Ответ с данными созданного инвентаря"""
    id: int = Field(description="Уникальный идентификатор")
    location: str = Field(description="Название локации")
    shift_type: str = Field(description="Тип смены")
    date: datetime = Field(description="Дата и время создания")
    cashier_name: str = Field(description="ФИО кассира")

    # НАПИТКИ
    il_primo_steklo: int
    voda_gornaya: int
    dobri_sok_pet: int
    kuragovi_kompot: int
    napitki_jb: int
    energetiky: int
    kold_bru: int
    kinza_napitky: int

    # ЕДА И ИНГРЕДИЕНТЫ
    palli: int
    barbeku_dip: int
    bulka_na_shaurmu: int
    lavash: int
    lepeshki: int
    ketchup_dip: int
    sirny_sous_dip: int
    kuriza_jareny: int
    kuriza_siraya: int

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "location": "Кафе Центральный",
                "shift_type": "morning",
                "date": "2025-05-28T10:30:00Z",
                "cashier_name": "Иванов Иван Иванович",
                "il_primo_steklo": 10,
                "voda_gornaya": 15,
                "palli": 25,
                "kuriza_jareny": 10
            }
        }