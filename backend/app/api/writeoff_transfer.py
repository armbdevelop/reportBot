from datetime import date, datetime, time
from fastapi import APIRouter, status, Form, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, desc, select, func
from app.crud import WriteoffTransferCRUD
from app.schemas import WriteoffTransferCreate, WriteoffTransferResponse, WriteoffEntry, TransferEntry
from typing import Optional, List
import json
from app.core import get_db, LOCATIONS
from app.models import WriteoffTransfer

# Коды локаций -> полные адреса
LOCATION_MAP = {
    'gagarina': 'Гагарина 48/1',
    'abdulhakima': 'Абдулхакима Исмаилова 51',
    'gaydara': 'Гайдара Гаджиева 7Б',
}

def normalize_location(loc: Optional[str]) -> Optional[str]:
    if not loc or loc == 'all':
        return None
    return LOCATION_MAP.get(loc, loc)

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
    - **Перемещения**: товары, которые переносятся между точками

    Каждая запись содержит:
    `{"name": "Название товара", "weight": вес/количество, "unit": "единица измерения", "reason": "Причина"}`

    ## Локации:
    - Гагарина 48/1
    - Абдулхакима Исмаилова 51  
    - Гайдара Гаджиева 7Б
    """,
)
async def create_writeoff_transfer(
        location_from: str = Form(
            ...,
            description="Локация отправления (для перемещений)",
            example="Гагарина 48/1"
        ),
        location_to: Optional[str] = Form(
            default=None,
            description="Локация назначения (для перемещений)",
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
        # Парсим дату и время из строк
        parsed_date = None
        parsed_time = None

        if report_date:
            try:
                parsed_date = datetime.strptime(report_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный формат даты. Используйте YYYY-MM-DD"
                )

        if report_time:
            try:
                parsed_time = datetime.strptime(report_time, "%H:%M").time()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный формат времени. Используйте HH:MM"
                )

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

        # Убираем обязательную валидацию - акт может быть пустым
        # if not writeoffs_list and not transfers_list:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Должна быть указана хотя бы одна запись в списаниях или перемещениях"
        #     )

        # Создаем акт
        report_data = WriteoffTransferCreate(
            location=location_from,
            location_to=location_to,
            writeoffs=writeoffs_list,
            transfers=transfers_list,
            cashier_name=cashier_name,
            shift_type=shift_type,
            report_date=parsed_date,
            report_time=parsed_time,
        )



        return await writeoff_transfer_crud.create_writeoff_transfer(db, report_data, writeoff_or_transfer)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ошибка при создании акта списания/перемещения: {str(e)}',
        )


@router.get(
    "/list",
    summary="Получить список отчетов списания/перемещения",
    description="Возвращает список отчетов списания и перемещения с пагинацией и фильтрацией по дате, локации и типу"
)
async def get_writeoff_transfer_reports_list(
    start_date: Optional[date] = Query(None, description="Дата начала периода (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Дата окончания периода (YYYY-MM-DD)"),
    location: Optional[str] = Query(None, description="Фильтр по локации (код или полный адрес)"),
    location_from: Optional[str] = Query(None, description="Локация отправления (код или адрес)"),
    location_to: Optional[str] = Query(None, description="Локация назначения (код или адрес)"),
    type: Optional[str] = Query(None, description="Тип отчета: writeoff или transfer"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(10, ge=1, le=100, description="Количество элементов на странице"),
    db: AsyncSession = Depends(get_db)
):
    """
    Получает список отчетов списания/перемещения с пагинацией и фильтрацией.
    """
    try:
        # Условия фильтрации
        conditions = []

        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            conditions.append(WriteoffTransfer.created_date >= start_datetime)

        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())
            conditions.append(WriteoffTransfer.created_date <= end_datetime)

        # Фильтр по любой из локаций (если передан общий параметр)
        if location:
            norm = normalize_location(location)
            if norm:
                conditions.append(or_(WriteoffTransfer.location == norm, WriteoffTransfer.location_to == norm))

        # Отдельные фильтры по source/destination
        if location_from:
            norm_from = normalize_location(location_from)
            if norm_from:
                conditions.append(WriteoffTransfer.location == norm_from)

        if location_to:
            norm_to = normalize_location(location_to)
            if norm_to:
                conditions.append(WriteoffTransfer.location_to == norm_to)

        # Фильтрация по типу (списание или перемещение)
        if type == "writeoff":
            conditions.append(WriteoffTransfer.writeoffs.isnot(None))
            # Для списаний локация назначения отсутствует -> IS NULL
            conditions.append(WriteoffTransfer.location_to.is_(None))

        elif type == "transfer":
            conditions.append(WriteoffTransfer.transfers.isnot(None))
            # Для перемещений локация назначения должна быть задана -> IS NOT NULL
            conditions.append(WriteoffTransfer.location_to.isnot(None))


        # Подсчет общего количества записей
        count_stmt = select(func.count(WriteoffTransfer.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        # Пагинация
        offset = (page - 1) * per_page

        # Основной запрос
        stmt = select(WriteoffTransfer)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(WriteoffTransfer.created_date)).offset(offset).limit(per_page)

        result = await db.execute(stmt)
        reports = result.scalars().all()

        # Формируем ответ
        reports_list = []
        for report in reports:
            report_type = None
            writeoffs_items = []
            transfers_items = []

            # Обрабатываем списания
            if report.writeoffs and len(report.writeoffs) > 0:
                report_type = "writeoff"
                writeoffs_items = report.writeoffs

            # Обрабатываем перемещения
            if report.transfers and len(report.transfers) > 0:
                if report_type:
                    report_type = "mixed"
                else:
                    report_type = "transfer"
                transfers_items = report.transfers

            # Формируем базовые данные отчета
            report_data = {
                "id": report.id,
                "location": report.location,
                "cashier_name": report.cashier_name,
                "shift_type": report.shift_type,
                "type": report_type,
                # Отправляем дату отчёта (указанную пользователем), а не время создания записи
                "date": report.date.isoformat() if report.date else None,
                "created_at": report.created_date.isoformat() if report.created_date else None,
                "writeoffs": writeoffs_items,
                "transfers": transfers_items,
                "items_count": len(writeoffs_items) + len(transfers_items)
            }

            # Для transfers обязательно добавляем location_to
            if report_type in ["transfer", "mixed"] and report.location_to:
                report_data["location_to"] = report.location_to

            # Для writeoffs location_to не нужно (или null)
            if report_type == "writeoff":
                report_data["location_to"] = None

            reports_list.append(report_data)

        return {
            "reports": reports_list,
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page
        }

    except Exception as e:
        print(f"❌ Ошибка получения списка отчетов списания/перемещения: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения списка отчетов"
        )


@router.get(
    "/{report_id}",
    summary="Получить отчет списания/перемещения по ID",
    description="Возвращает детальную информацию об отчете списания/перемещения"
)
async def get_writeoff_transfer_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Получает детальную информацию об отчете списания/перемещения по ID.
    """
    try:
        report = await db.get(WriteoffTransfer, report_id)

        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Отчет не найден"
            )

        # Определяем тип отчета
        report_type = None
        if report.writeoffs and len(report.writeoffs) > 0:
            report_type = "writeoff"
        if report.transfers and len(report.transfers) > 0:
            if report_type:
                report_type = "mixed"
            else:
                report_type = "transfer"

        return {
            "id": report.id,
            "location": report.location,
            "location_to": report.location_to,
            "cashier_name": report.cashier_name,
            "shift_type": report.shift_type,
            "type": report_type,
            "writeoffs": report.writeoffs if report.writeoffs else [],
            "transfers": report.transfers if report.transfers else [],
            "report_date": report.report_date.isoformat() if report.report_date else None,
            "report_time": report.report_time.isoformat() if report.report_time else None,
            "created_at": report.created_date.isoformat() if report.created_date else None,
            "updated_at": None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения отчета списания/перемещения: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения отчета"
        )


@router.delete("/writeoff-transfer/{report_id}")
async def delete_writeoff_transfer_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Удаление отчета списания или перемещения"""
    try:
        # Получаем отчет для проверки существования
        report = await writeoff_transfer_crud.get(db, id=report_id)
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Отчет не найден"
            )

        # Удаляем отчет из БД
        await writeoff_transfer_crud.remove(db, id=report_id)
        await db.commit()

        # Определяем тип отчета на основе того, какие данные содержит
        has_writeoffs = report.writeoffs and len(report.writeoffs) > 0
        has_transfers = report.transfers and len(report.transfers) > 0

        if has_writeoffs and has_transfers:
            report_type = "списания и перемещения"
        elif has_writeoffs:
            report_type = "списания"
        elif has_transfers:
            report_type = "перемещения"
        else:
            report_type = "списания/перемещения"

        return {"message": f"Отчет {report_type} успешно удален", "deleted_id": report_id}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка при удалении отчета списания/перемещения {report_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении отчета"
        )
