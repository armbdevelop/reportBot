from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class InventoryItemCreate(BaseModel):
    """Схема для создания товара"""
    name: str = Field(..., min_length=1, max_length=255, description="Название товара")
    unit: str = Field(default="шт", max_length=50, description="Единица измерения")
    is_active: bool = Field(default=True, description="Активен ли товар")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Кола 0.5л",
                "unit": "шт",
                "is_active": True
            }
        }


class InventoryItemUpdate(BaseModel):
    """Схема для обновления товара"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Название товара")
    unit: Optional[str] = Field(None, max_length=50, description="Единица измерения")
    is_active: Optional[bool] = Field(None, description="Активен ли товар")


class InventoryItemResponse(BaseModel):
    """Ответ с данными товара"""
    id: int
    name: str
    unit: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryItemList(BaseModel):
    """Список товаров"""
    items: List[InventoryItemResponse]
    total: int