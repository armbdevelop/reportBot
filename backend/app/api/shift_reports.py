from typing import Optional, List
import json
from datetime import datetime, date
from decimal import InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_, desc, select, func
from app.schemas import ShiftReportCreate, ShiftReportResponse, IncomeEntry, ExpenseEntry
from app.crud import ShiftReportCRUD
from app.core import get_db
from app.models import ShiftReport

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

def get_photo_url(photo_path: str) -> Optional[str]:
    """Формирует корректный URL для фотографии из пути к файлу"""
    if not photo_path:
        return None
    try:
        # Путь к папке uploads
        upload_folder = "uploads"
        # Получаем относительный путь от папки uploads
        if photo_path.startswith(upload_folder):
            relative_path = photo_path[len(upload_folder):].lstrip('/')
            return f"/uploads/{relative_path}"
        else:
            return f"/uploads/{photo_path}"
    except Exception:
        # Если не удается получить относительный путь, возвращаем как есть
        return photo_path


router = APIRouter()
shift_report_crud = ShiftReportCRUD()


@router.post(
    "/create",
    response_model=ShiftReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать отчет завершения смены",
    description="""
    Создает новый отчет завершения смены с автоматическими расчетами сверки кассы.

    **Формула расчета:**
    `Расчетная сумма = Выручка - Возвраты + Приходы - Расходы - Эквайринг`

    **Примечание:** Отправка в Telegram происходит асинхронно и не влияет на создание отчета.
    """,
)
async def create_shift_report(
        # Основные поля
        location: str = Form(..., description="Название локации", example="Кафе Центральный"),
        shift_type: str = Form(..., regex="^(morning|night)$", description="Тип смены", example="morning"),
        cashier_name: str = Form(..., description="ФИО кассира", example="Иванов Иван"),

        # Финансовые данные
        total_revenue: int = Form(..., description="Общая выручка", example=15000, ge=0),
        returns: int = Form(default=0, description="Возвраты", example=200, ge=0),
        acquiring: int = Form(default=0, description="Эквайринг", example=5000, ge=0),
        qr_code: int = Form(default=0, description="QR код", example=1500, ge=0),
        online_app: int = Form(default=0, description="Онлайн приложение", example=2000, ge=0),
        yandex_food: int = Form(default=0, description="Яндекс Еда", example=1200, ge=0),
        # НОВЫЕ ПОЛЯ
        yandex_food_no_system: int = Form(default=0, description="Яндекс.Еда - не пришел заказ в систему",
                                          example=300, ge=0),
        primehill: int = Form(default=0, description="Primehill", example=500, ge=0),

        fact_cash: int = Form(..., description="Фактическая наличность", example=5100),

        # JSON поля
        income_entries_json: Optional[str] = Form(
            default=None,
            description='JSON приходов. Пример: [{"amount": 500, "comment": "Описание"}]',
            example='[{"amount": 500, "comment": "Внесение от администратора"}]'
        ),
        expense_entries_json: Optional[str] = Form(
            default=None,
            description='JSON расходов. Пример: [{"description": "Описание", "amount": 125}]',
            example='[{"description": "Покупка канцтоваров", "amount": 125}]'
        ),

        # Фото
        photo: UploadFile = File(..., description="Фото кассового отчета"),

        comments: Optional[str] = Form(default=None, description="Комментарии"),

        db: AsyncSession = Depends(get_db)
):
    """
    Создает отчет завершения смены.

    Процесс:
    1. Валидация входных данных
    2. Создание записи в базе данных
    3. Асинхронная отправка в Telegram (в фоне)

    Если есть проблемы с Telegram, отчет все равно будет создан в БД.
    """
    try:
        # Парсим и валидируем входные данные
        income_entries = _parse_income_entries(income_entries_json)
        expense_entries = _parse_expense_entries(expense_entries_json)

        # Создаем объект данных
        report_data = ShiftReportCreate(
            location=location,
            shift_type=shift_type,
            cashier_name=cashier_name,
            income_entries=income_entries,
            expense_entries=expense_entries,
            total_revenue=total_revenue,
            returns=returns,
            acquiring=acquiring,
            qr_code=qr_code,
            online_app=online_app,
            yandex_food=yandex_food,
            yandex_food_no_system=yandex_food_no_system,
            primehill=primehill,
            fact_cash=fact_cash,
            comments=comments,
        )

        # Создаем отчет в базе данных
        report = await shift_report_crud.create_shift_report(db, report_data, photo)

        return report

    except HTTPException:
        # HTTP исключения пробрасываем как есть
        raise
    except SQLAlchemyError as e:
        # Ошибки базы данных
        print(f"❌ Ошибка БД при создании отчета: {str(e)}")
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка базы данных при создании отчета"
        )
    except Exception as e:
        # Все остальные ошибки
        print(f"❌ Неожиданная ошибка при создании отчета: {str(e)}")
        try:
            await db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Неожиданная ошибка при создании отчета"
        )


def _parse_income_entries(income_entries_json: Optional[str]) -> List[IncomeEntry]:
    """Парсит и валидирует записи приходов."""
    income_entries = []
    if income_entries_json:
        try:
            income_data = json.loads(income_entries_json)
            if not isinstance(income_data, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="income_entries_json должен быть массивом JSON"
                )

            for item in income_data:
                if not isinstance(item, dict) or 'amount' not in item or 'comment' not in item:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Каждый элемент income_entries должен содержать 'amount' и 'comment'"
                    )

                try:
                    amount = int(str(item['amount']))
                    if amount <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сумма прихода должна быть положительной"
                        )

                    income_entries.append(IncomeEntry(
                        amount=amount,
                        comment=str(item['comment'])
                    ))
                except (ValueError, TypeError, InvalidOperation):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Некорректная сумма в приходе: {item.get('amount')}"
                    )

        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный JSON в income_entries_json"
            )

    return income_entries


def _parse_expense_entries(expense_entries_json: Optional[str]) -> List[ExpenseEntry]:
    """Парсит и валидирует записи расходов."""
    expense_entries = []
    if expense_entries_json:
        try:
            expense_data = json.loads(expense_entries_json)
            if not isinstance(expense_data, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="expense_entries_json должен быть массивом JSON"
                )

            for item in expense_data:
                if not isinstance(item, dict) or 'description' not in item or 'amount' not in item:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Каждый элемент expense_entries должен содержать 'description' и 'amount'"
                    )

                try:
                    amount = int(str(item['amount']))
                    if amount <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Сумма расхода должна быть положительной"
                        )

                    expense_entries.append(ExpenseEntry(
                        description=str(item['description']),
                        amount=amount
                    ))
                except (ValueError, TypeError, InvalidOperation):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Некорректная сумма в расходе: {item.get('amount')}"
                    )

        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный JSON в expense_entries_json"
            )

    return expense_entries


@router.get(
    "/list",
    summary="Получить список отчетов смены",
    description="Возвращает список отчетов смены с пагинацией и фильтрацией по дате и локации"
)
async def get_shift_reports_list(
    start_date: Optional[date] = Query(None, description="Дата начала периода (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Дата окончания периода (YYYY-MM-DD)"),
    location: Optional[str] = Query(None, description="Фильтр по локации"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(10, ge=1, le=100, description="Количество элементов на странице"),
    db: AsyncSession = Depends(get_db)
):
    """
    Получает список отчетов смены с пагинацией и фильтрацией.
    """
    try:
        # Условия фильтрации
        conditions = []

        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            conditions.append(ShiftReport.created_at >= start_datetime)

        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())
            conditions.append(ShiftReport.created_at <= end_datetime)

        if location:
            norm_loc = normalize_location(location)
            if norm_loc:
                conditions.append(ShiftReport.location == norm_loc)

        # Подсчет общего количества записей
        count_stmt = select(func.count(ShiftReport.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        # Пагинация
        offset = (page - 1) * per_page

        # Основной запрос
        stmt = select(ShiftReport)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(ShiftReport.created_at)).offset(offset).limit(per_page)

        result = await db.execute(stmt)
        reports = result.scalars().all()

        # Формируем ответ
        reports_list = []
        for report in reports:
            reports_list.append({
                "id": report.id,
                "location": report.location,
                "shift_type": report.shift_type,
                "cashier_name": report.cashier_name,
                "date": report.date.isoformat() if report.date else None,
                "total_revenue": float(report.total_revenue) if report.total_revenue else 0,
                "returns": float(report.returns) if report.returns else 0,
                "acquiring": float(report.acquiring) if report.acquiring else 0,
                "qr_code": float(report.qr_code) if report.qr_code else 0,
                "online_app": float(report.online_app) if report.online_app else 0,
                "yandex_food": float(report.yandex_food) if report.yandex_food else 0,
                "yandex_food_no_system": float(report.yandex_food_no_system) if report.yandex_food_no_system else 0,
                "primehill": float(report.primehill) if report.primehill else 0,
                "total_acquiring": float(report.total_acquiring) if report.total_acquiring else 0,
                "total_income": float(report.total_income) if report.total_income else 0,
                "total_expenses": float(report.total_expenses) if report.total_expenses else 0,
                "fact_cash": float(report.fact_cash) if report.fact_cash else 0,
                "calculated_amount": float(report.calculated_amount) if report.calculated_amount else 0,
                "difference": float(report.surplus_shortage) if report.surplus_shortage else 0,
                "income_entries": report.income_entries if report.income_entries else [],
                "expense_entries": report.expense_entries if report.expense_entries else [],
                "comments": report.comments,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "photo_url": get_photo_url(report.photo_path),
            })

        return {
            "reports": reports_list,
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page
        }

    except Exception as e:
        print(f"❌ Ошибка получения списка отчетов смены: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения списка отчетов"
        )


@router.get(
    "/{report_id}",
    summary="Получить отчет смены по ID",
    description="Возвращает детальную информацию об отчете смены"
)
async def get_shift_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Получает детальную информацию об отчете смены по ID.
    """
    try:
        report = await db.get(ShiftReport, report_id)

        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Отчет не найден"
            )

        return {
            "id": report.id,
            "location": report.location,
            "shift_type": report.shift_type,
            "cashier_name": report.cashier_name,
            "date": report.date.isoformat() if report.date else None,
            "total_revenue": float(report.total_revenue) if report.total_revenue else 0,
            "returns": float(report.returns) if report.returns else 0,
            "acquiring": float(report.acquiring) if report.acquiring else 0,
            "qr_code": float(report.qr_code) if report.qr_code else 0,
            "online_app": float(report.online_app) if report.online_app else 0,
            "yandex_food": float(report.yandex_food) if report.yandex_food else 0,
            "yandex_food_no_system": float(report.yandex_food_no_system) if report.yandex_food_no_system else 0,
            "primehill": float(report.primehill) if report.primehill else 0,
            "total_acquiring": float(report.total_acquiring) if report.total_acquiring else 0,
            "total_income": float(report.total_income) if report.total_income else 0,
            "total_expenses": float(report.total_expenses) if report.total_expenses else 0,
            "fact_cash": float(report.fact_cash) if report.fact_cash else 0,
            "calculated_amount": float(report.calculated_amount) if report.calculated_amount else 0,
            "difference": float(report.surplus_shortage) if report.surplus_shortage else 0,
            "income_entries": report.income_entries if report.income_entries else [],
            "expense_entries": report.expense_entries if report.expense_entries else [],
            "comments": report.comments,
            "photo_url": get_photo_url(report.photo_path),
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "updated_at": report.updated_at.isoformat() if report.updated_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения отчета смены: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения отчета"
        )
