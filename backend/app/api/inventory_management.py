from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.core import get_db
from app.crud.inventory_item import inventory_crud
from app.schemas.inventory_item import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemList
)

router = APIRouter()


@router.get(
    "/items",
    response_model=InventoryItemList,
    summary="Получить список товаров",
    description="Получает список всех товаров с возможностью фильтрации"
)
async def get_items(
    is_active: Optional[bool] = Query(None, description="Активные товары"),
    skip: int = Query(0, ge=0, description="Пропустить записей"),
    limit: int = Query(100, ge=1, le=1000, description="Максимум записей"),
    db: AsyncSession = Depends(get_db)
):
    """Получить список товаров с фильтрацией"""
    items, total = await inventory_crud.get_items(
        db, is_active=is_active, skip=skip, limit=limit
    )
    return InventoryItemList(items=items, total=total)


@router.get(
    "/items/{item_id}",
    response_model=InventoryItemResponse,
    summary="Получить товар по ID"
)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить товар по ID"""
    item = await inventory_crud.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return item


@router.post(
    "/items",
    response_model=InventoryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать новый товар"
)
async def create_item(
    item_data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Создать новый товар"""
    return await inventory_crud.create_item(db, item_data)


@router.put(
    "/items/{item_id}",
    response_model=InventoryItemResponse,
    summary="Обновить товар"
)
async def update_item(
    item_id: int,
    item_data: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновить товар"""
    updated_item = await inventory_crud.update_item(db, item_id, item_data)
    if not updated_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return updated_item


@router.delete(
    "/items/{item_id}",
    summary="Удалить товар",
    description="Удаляет товар (мягкое удаление). Только для администраторов!"
)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Удалить товар (мягкое удаление)"""
    success = await inventory_crud.delete_item(db, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return {"message": "Товар успешно удален"}