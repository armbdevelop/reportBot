from decimal import Decimal
from typing import List
from app.schemas import IncomeEntry, ExpenseEntry


class ReportCalculator:
    @staticmethod
    def calculate_shift_report(
            total_revenue: Decimal,
            returns: Decimal,
            income_entries: List[IncomeEntry],
            expense_entries: List[ExpenseEntry],
            acquiring: Decimal,
            qr_code: Decimal,
            online_app: Decimal,
            yandex_food: Decimal,
            yandex_food_no_system: Decimal,  # НОВОЕ ПОЛЕ
            primehill: Decimal,  # НОВОЕ ПОЛЕ
            fact_cash: Decimal
    ) -> dict:
        """
        Рассчитывает сверку для отчета завершения смены.

        Формула: (общая выручка) - (возвраты) + (внесения) - (итоговый расход) - (итого эквайринг)
        """
        # Считаем общую сумму приходов
        total_income = round((sum(entry.amount for entry in income_entries)),0)//1

        # Считаем общую сумму расходов
        total_expenses = round((sum(entry.amount for entry in expense_entries)), 0)//1

        # Считаем общую сумму эквайринга (все отмеченные "*" пункты + новые поля)
        total_acquiring = round((
            acquiring +
            qr_code +
            online_app +
            yandex_food +
            yandex_food_no_system +  # ДОБАВЛЕНО
            primehill  # ДОБАВЛЕНО
        ),0)//1

        # Применяем формулу расчета
        calculated_amount = round((total_revenue - returns + total_income - total_expenses - total_acquiring),0)//1

        # Определяем излишек/недостачу
        surplus_shortage = (fact_cash - calculated_amount)//1

        return {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "total_acquiring": total_acquiring,
            "calculated_amount": calculated_amount,
            "surplus_shortage": surplus_shortage
        }