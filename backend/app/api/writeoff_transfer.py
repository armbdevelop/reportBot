from datetime import date, datetime
from fastapi import APIRouter, status, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import WriteoffTransferCRUD
from app.schemas import WriteoffTransferCreate, WriteoffTransferResponse, WriteoffEntry, TransferEntry
from typing import Optional, List
import json
from app.core import get_db, LOCATIONS

router = APIRouter()
writeoff_transfer_crud = WriteoffTransferCRUD()


@router.post(
    "/create",
    response_model=WriteoffTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать акт списания/перемещения",
    description="""
    Создает акт списания и перемещения товаров с указанием причин.

    ## Структура данных
    - **Списания**: товары, которые порчены и подлежат утилизации
    - **Перемещения**: товары, которые переносятся на другие точки

    Каждая запись содержит:
    `{"name": "Название товара", "weight": вес/количество, "unit": "единица измерения", "reason": "Причина"}`

    ## Локации:
    - Гагарина 48/1
    - Абдулхакима Исмаилова 51  
    - Гайдара Гаджиева 7Б
    """,
)
async def create_writeoff_transfer(
        location: str = Form(
            ...,
            description="Название локации",
            example="Абдулхакима Исмаилова 51"
        ),


        writeoffs_json: Optional[str] = Form(
            default=None,
            description="""JSON массив списаний товаров.

Каждый элемент должен содержать:
- name: наименование товара (строка)
- weight: вес/количество (положительное число)  
- unit: единица измерения (строка)
- reason: причина порчи (строка)

Пример: [{"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"}]""",
            example='[{"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"}]'
        ),

        transfers_json: Optional[str] = Form(
            default=None,
            description="""JSON массив перемещений товаров.

Каждый элемент должен содержать:
- name: наименование товара (строка)
- weight: вес/количество (положительное число)
- unit: единица измерения (строка)
- reason: причина перемещения (строка)
date
Пример: [{"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"}]""",
            example='[{"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"}]'
        ),
        report_date: Optional[str] = Form(None, description="Дата отчета (YYYY-MM-DD) - опционально"),
        report_time: Optional[str] = Form(None, description="Время отчета (HH:MM) - опционально"),

        shift_type: str = Form(..., regex="^(morning|night)$", description="Тип смены", example="morning"),
        cashier_name: str = Form(..., description="ФИО кассира", example="Иванов Иван"),
        writeoff_or_transfer: str = Form(...),
        db: AsyncSession = Depends(get_db),
) -> WriteoffTransferResponse:
    """
    Создать акт списания и перемещения товаров.
    """
    try:

        # Парсим списания
        writeoffs_list = []
        if writeoffs_json:
            try:
                writeoffs_data = json.loads(writeoffs_json)
                if not isinstance(writeoffs_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="writeoffs_json должен быть массивом JSON"
                    )

                for item in writeoffs_data:
                    if not isinstance(item, dict) or 'name' not in item or 'weight' not in item or 'unit' not in item or 'reason' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент списания должен содержать 'name', 'weight', 'unit' и 'reason'"
                        )

                    if not isinstance(item['weight'], (int, float)) or item['weight'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Вес/количество товара должно быть положительным числом"
                        )

                    writeoffs_list.append(WriteoffEntry(
                        name=str(item['name']),
                        weight=round(item['weight'], 0)//1,
                        unit=str(item['unit']),
                        reason=str(item['reason'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в writeoffs_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации списаний: {str(e)}"
                )

        # Парсим перемещения
        transfers_list = []
        if transfers_json:
            try:
                transfers_data = json.loads(transfers_json)
                if not isinstance(transfers_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="transfers_json должен быть массивом JSON"
                    )

                for item in transfers_data:
                    if not isinstance(item, dict) or 'name' not in item or 'weight' not in item or 'unit' not in item or 'reason' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент перемещения должен содержать 'name', 'weight', 'unit' и 'reason'"
                        )

                    if not isinstance(item['weight'], (int, float)) or item['weight'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Вес/количество товара должно быть положительным числом"
                        )

                    transfers_list.append(TransferEntry(
                        name=str(item['name']),
                        weight=round(item['weight'], 0)//1,
                        unit=str(item['unit']),
                        reason=str(item['reason'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в transfers_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации перемещений: {str(e)}"
                )

        # Проверяем, что есть хотя бы одна запись
        if not writeoffs_list and not transfers_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Должна быть указана хотя бы одна запись в списаниях или перемещениях"
            )


        # Создаем акт
        report_data = WriteoffTransferCreate(
            location=location,
            writeoffs=writeoffs_list,
            transfers=transfers_list,
            cashier_name=cashier_name,
            shift_type=shift_type,
            report_date=report_date,
            report_time=report_time,
        )



        return await writeoff_transfer_crud.create_writeoff_transfer(db, report_data, writeoff_or_transfer)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ошибка при создании акта списания/перемещения: {str(e)}',
        )