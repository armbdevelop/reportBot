# backend/app/models/inventory_item.py
from sqlalchemy import Column, String, DateTime, func, Integer, Boolean
from .base import Base


class InventoryItem(Base):
    """Модель товара для инвентаризации"""
    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False, unique=True)  # Название товара
    unit = Column(String(50), nullable=False, default="шт")  # Единица измерения
    is_active = Column(Boolean, nullable=False, default=True)  # Активен ли товар

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)