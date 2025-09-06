from typing import Optional, List
import json
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from app.schemas import ShiftReportCreate, ShiftReportResponse, IncomeEntry, ExpenseEntry
from app.crud import ShiftReportCRUD
from app.core import get_db

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
        total_revenue: int = Form(..., description="Общая выручка", example=15000.50, ge=0),
        returns: int = Form(default=0, description="Возвраты", example=200.00, ge=0),
        acquiring: int = Form(default=0, description="Эквайринг", example=5000.00, ge=0),
        qr_code: int = Form(default=0, description="QR код", example=1500.00, ge=0),
        online_app: int = Form(default=0, description="Онлайн приложение", example=2000.00, ge=0),
        yandex_food: int = Form(default=0, description="Яндекс Еда", example=1200.00, ge=0),
        # НОВЫЕ ПОЛЯ
        yandex_food_no_system: int = Form(default=0, description="Яндекс.Еда - не пришел заказ в систему",
                                          example=300.00, ge=0),
        primehill: int = Form(default=0, description="Primehill", example=500.00, ge=0),

        fact_cash: int = Form(..., description="Фактическая наличность", example=5100.50),

        # JSON поля
        income_entries_json: Optional[str] = Form(
            default=None,
            description='JSON приходов. Пример: [{"amount": 500.50, "comment": "Описание"}]',
            example='[{"amount": 500.50, "comment": "Внесение от администратора"}]'
        ),
        expense_entries_json: Optional[str] = Form(
            default=None,
            description='JSON расходов. Пример: [{"description": "Описание", "amount": 125.75}]',
            example='[{"description": "Покупка канцтоваров", "amount": 125.75}]'
        ),

        # Фото
        photo: UploadFile = File(..., description="Фото кассового отчета"),

        comments: Optional[str] = Form(default=None, description="Комметарий"),

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

        # Проверяем лимиты
        # _validate_entries_limits(income_entries, expense_entries)

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
            yandex_food_no_system=yandex_food_no_system,  # НОВОЕ ПОЛЕ
            primehill=primehill,  # НОВОЕ ПОЛЕ
            fact_cash=fact_cash,
            comments=comments,
        )

        # Создаем отчет в базе данных
        report = await shift_report_crud.create_shift_report(db, report_data, photo)

        return report

    except HTTPException:
        # HTTP исключения пробрасываем как есть (они уже правильно сформированы)
        raise
    except SQLAlchemyError as db_error:
        # Ошибки базы данных
        print(f"❌ Ошибка БД при создании отчета: {str(db_error)}")
        try:
            await db.rollback()
        except:
            pass  # Игнорируем ошибки rollback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка базы данных при создании отчета"
        )
    except Exception as e:
        # Все остальные ошибки
        print(f"❌ Неожиданная ошибка при создании отчета: {str(e)}")
        try:
            await db.rollback()
        except:
            pass  # Игнорируем ошибки rollback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Неожиданная ошибка при создании отчета"
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
                except (ValueError, TypeError, int.InvalidOperation):
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
                except (ValueError, TypeError, int.InvalidOperation):
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


# def _validate_entries_limits(income_entries: List[IncomeEntry], expense_entries: List[ExpenseEntry]):
#     """Проверяет лимиты на количество записей."""
#     if len(income_entries) > 30:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Максимум 30 записей приходов"
#         )
#
#     if len(expense_entries) > 30:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Максимум 30 записей расходов"
#         )

