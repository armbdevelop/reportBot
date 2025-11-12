from sqlalchemy import Column, Integer, String, DateTime, JSON, Numeric, Text, func
from .base import Base


class ShiftReport(Base):
    __tablename__ = "shift_reports"

    id = Column(Integer, primary_key=True, index=True)
    location = Column(String(255), nullable=False)
    shift_type = Column(String(20), nullable=False)  # "morning" или "night"
    date = Column(DateTime(timezone=True),nullable=False)
    cashier_name = Column(String(255), nullable=False)

    # Приходы денег/внесения (максимум 5 полей)
    income_entries = Column(JSON, nullable=True, default=list)
    total_income = Column(Numeric(10, 2), nullable=False, default=0)

    # Расходы (максимум 10 полей)
    expense_entries = Column(JSON, nullable=True, default=list)
    total_expenses = Column(Numeric(10, 2), nullable=False, default=0)

    # Информация из iiko
    total_revenue = Column(Numeric(10, 2), nullable=False)
    returns = Column(Numeric(10, 2), nullable=False, default=0)
    acquiring = Column(Numeric(10, 2), nullable=False, default=0)
    qr_code = Column(Numeric(10, 2), nullable=False, default=0)
    online_app = Column(Numeric(10, 2), nullable=False, default=0)
    yandex_food = Column(Numeric(10, 2), nullable=False, default=0)
    # НОВЫЕ ПОЛЯ
    yandex_food_no_system = Column(Numeric(10, 2), nullable=False, default=0)
    primehill = Column(Numeric(10, 2), nullable=False, default=0)

    # Итоговые расчеты
    fact_cash = Column(Numeric(10, 2), nullable=False)  # Указывает кассир
    total_acquiring = Column(Numeric(10, 2), nullable=False, default=0)  # Автоподсчет
    calculated_amount = Column(Numeric(10, 2), nullable=False, default=0)  # По формуле
    surplus_shortage = Column(Numeric(10, 2), nullable=False, default=0)  # Излишек/недостача

    # Фото кассового отчета (ОБЯЗАТЕЛЬНО!)
    photo_path = Column(Text, nullable=False)

    # НОВОЕ: Фото чека с магазина (НЕОБЯЗАТЕЛЬНО!)
    receipt_photo_path = Column(Text, nullable=True)

    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), nullable=False, default="draft")  # "draft", "sent"

    comments = Column(Text, nullable=True)