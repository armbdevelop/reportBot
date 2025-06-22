from typing import Annotated
from fastapi import APIRouter, status, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import DailyInventoryResponse, DailyInventoryCreate
from app.core import get_db
from app.crud import DailyInventoryCrud

router = APIRouter()


@router.post(
    '/create',
    response_model=DailyInventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать ежедневный инвентарь",
    description="""
    Создает отчет ежедневного инвентаря для учета товаров на складе.

    ## Товары для учета:
    - **Напитки**: il_primo_steklo, voda_gornaya, dobri_sok_pet, kuragovi_kompot, napitki_jb, energetiky, kold_bru, kinza_napitky
    - **Еда**: palli, barbeku_dip, bulka_na_shaurmu, lavash, ketchup_dip, sirny_sous_dip, kuriza_jareny, kuriza_siraya

    Все количества указываются в штуках (целые числа ≥ 0).
    """,
    responses={
        201: {
            "description": "Инвентарь успешно создан",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "location": "Кафе Центральный",
                        "shift_type": "morning",
                        "date": "2025-05-28T10:30:00Z",
                        "cashier_name": "Иванов Иван",
                        "il_primo_steklo": 10,
                        "voda_gornaya": 5,
                        "palli": 20
                    }
                }
            }
        },
        400: {
            "description": "Ошибка валидации данных",
            "content": {
                "application/json": {
                    "examples": {
                        "validation_error": {
                            "summary": "Ошибка валидации",
                            "value": {"detail": "Ошибка создания отчета: количество не может быть отрицательным"}
                        }
                    }
                }
            }
        }
    }
)
async def daily_inventory_create(
        location: Annotated[str, Form(
            ...,
            min_length=1,
            max_length=255,
            description="Название локации",
            example="Кафе Центральный"
        )],
        shift_type: Annotated[str, Form(
            ...,
            pattern=r"^(morning|night)$",
            description="Смена: morning (утренняя) или night (ночная)",
            example="morning"
        )],
        cashier_name: Annotated[str, Form(
            ...,
            min_length=1,
            max_length=255,
            description="ФИО кассира",
            example="Иванов Иван Иванович"
        )],

        # НАПИТКИ
        il_primo_steklo: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество Il Primo (стекло), шт",
            example=10
        )],
        voda_gornaya: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество горной воды, шт",
            example=15
        )],
        dobri_sok_pet: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество сока Добрый (ПЭТ), шт",
            example=8
        )],
        kuragovi_kompot: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество кураговый компот, шт",
            example=5
        )],
        napitki_jb: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество напитков JB, шт",
            example=12
        )],
        energetiky: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество энергетиков, шт",
            example=6
        )],
        kold_bru: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество колд брю, шт",
            example=4
        )],
        kinza_napitky: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество напитков Кинза, шт",
            example=7
        )],

        # ЕДА И ИНГРЕДИЕНТЫ
        palli: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество палли (лепешки), шт",
            example=25
        )],
        barbeku_dip: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество барбекю дипа, шт",
            example=3
        )],
        bulka_na_shaurmu: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество булок для шаурмы, шт",
            example=20
        )],
        lavash: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество лаваша, шт",
            example=15
        )],
        lepeshki: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество лепешек",
            example=10
        )],
        ketchup_dip: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество кетчуп дипа, шт",
            example=5
        )],
        sirny_sous_dip: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество сырного соуса дип, шт",
            example=4
        )],
        kuriza_jareny: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество жареной курицы, шт",
            example=10
        )],
        kuriza_siraya: Annotated[int, Form(
            ...,
            ge=0,
            description="Количество сырой курицы, шт",
            example=8
        )],

        db: AsyncSession = Depends(get_db)
):
    """
    Создать отчет ежедневного инвентаря.

    ## Назначение
    Этот эндпоинт используется для создания отчетов о количестве товаров на складе в начале или конце смены.

    ## Категории товаров

    ### Напитки:
    - Il Primo (стекло)
    - Горная вода
    - Сок Добрый (ПЭТ)
    - Кураговый компот
    - Напитки JB
    - Энергетики
    - Колд брю
    - Напитки Кинза

    ### Еда и ингредиенты:
    - Палли (лепешки)
    - Барбекю дип
    - Булки для шаурмы
    - Лаваш
    - Кетчуп дип
    - Сырный соус дип
    - Жареная курица
    - Сырая курица

    ## Правила заполнения
    - Все количества в штуках (целые числа)
    - Количество не может быть отрицательным
    - Обязательно указывать смену и кассира
    """
    try:
        daily_data = DailyInventoryCreate(
            location=location,
            shift_type=shift_type,
            cashier_name=cashier_name,
            il_primo_steklo=il_primo_steklo,
            voda_gornaya=voda_gornaya,
            dobri_sok_pet=dobri_sok_pet,
            kuragovi_kompot=kuragovi_kompot,
            napitki_jb=napitki_jb,
            energetiky=energetiky,
            kold_bru=kold_bru,
            kinza_napitky=kinza_napitky,
            palli=palli,
            barbeku_dip=barbeku_dip,
            bulka_na_shaurmu=bulka_na_shaurmu,
            lavash=lavash,
            lepeshki=lepeshki,
            ketchup_dip=ketchup_dip,
            sirny_sous_dip=sirny_sous_dip,
            kuriza_jareny=kuriza_jareny,
            kuriza_siraya=kuriza_siraya,
        )

        return await DailyInventoryCrud().create_daily_inventory(db, daily_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка создания отчета инвентаря: {str(e)}"
        )