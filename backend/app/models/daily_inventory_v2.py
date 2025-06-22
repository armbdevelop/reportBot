# backend/app/models/daily_inventory_v2.py
from sqlalchemy import Column, String, DateTime, func, Integer, JSON
from .base import Base


class DailyInventoryV2(Base):
    """Новая модель ежедневной инвентаризации с динамическими товарами"""
    id = Column(Integer, primary_key=True, index=True)

    location = Column(String(255), nullable=False)
    shift_type = Column(String(20), nullable=False)  # "morning" или "night"
    cashier_name = Column(String(255), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)

    # JSON поле для хранения данных инвентаризации
    # Структура: [{"item_id": 1, "quantity": 10}, {"item_id": 2, "quantity": 5}]
    inventory_data = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)