# backend/app/api/daily_inventory_v2.py
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core import get_db
from app.crud.daily_inventory_v2 import DailyInventoryV2CRUD
from app.schemas.daily_inventory_v2 import DailyInventoryV2Create, DailyInventoryV2Response

router = APIRouter()
inventory_v2_crud = DailyInventoryV2CRUD()


@router.post(
    "/create",
    response_model=DailyInventoryV2Response,
    status_code=status.HTTP_201_CREATED,
    summary="Создать новую инвентаризацию",
    description="Создает отчет ежедневной инвентаризации с использованием новой системы управления товарами и автоматической отправкой в Telegram"
)
async def create_inventory_v2(
        inventory_data: DailyInventoryV2Create,
        db: AsyncSession = Depends(get_db)
):
    """Создать новую инвентаризацию с использованием системы управления товарами"""
    return await inventory_v2_crud.create_inventory(db, inventory_data)


@router.get(
    "/{inventory_id}/detailed",
    response_model=Dict[str, Any],
    summary="Получить детальную инвентаризацию",
    description="Получает инвентаризацию с детальной информацией о товарах"
)
async def get_detailed_inventory(
        inventory_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Получить детальную информацию об инвентаризации"""
    inventory = await inventory_v2_crud.get_inventory_with_items(db, inventory_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Инвентаризация не найдена"
        )
    return inventory


@router.get(
    "/list",
    summary="Получить список инвентаризаций",
    description="Получает список всех инвентаризаций с возможностью фильтрации"
)
async def get_inventories_list(
        location: Optional[str] = Query(None, description="Фильтр по локации"),
        shift_type: Optional[str] = Query(None, description="Фильтр по типу смены"),
        skip: int = Query(0, ge=0, description="Пропустить записей"),
        limit: int = Query(100, ge=1, le=1000, description="Максимум записей"),
        db: AsyncSession = Depends(get_db)
):
    """Получить список инвентаризаций с фильтрацией"""
    inventories, total = await inventory_v2_crud.get_inventory_list(
        db, location=location, shift_type=shift_type, skip=skip, limit=limit
    )

    # Преобразуем в простой формат для ответа
    inventory_list = []
    for inventory in inventories:
        inventory_list.append({
            "id": inventory.id,
            "location": inventory.location,
            "shift_type": inventory.shift_type,
            "cashier_name": inventory.cashier_name,
            "date": inventory.date,
            "items_count": len(inventory.inventory_data) if inventory.inventory_data else 0,
            "created_at": inventory.created_at,
            "updated_at": inventory.updated_at
        })

    return {
        "inventories": inventory_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.delete(
    "/{inventory_id}",
    summary="Удалить инвентаризацию",
    description="Удаляет инвентаризацию по ID"
)
async def delete_inventory(
        inventory_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Удалить инвентаризацию"""
    success = await inventory_v2_crud.delete_inventory(db, inventory_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Инвентаризация не найдена"
        )
    return {"message": "Инвентаризация успешно удалена"}


@router.get(
    "/stats",
    summary="Статистика по инвентаризациям",
    description="Получает базовую статистику по инвентаризациям"
)
async def get_inventory_stats(
        location: Optional[str] = Query(None, description="Фильтр по локации"),
        db: AsyncSession = Depends(get_db)
):
    """Получить статистику по инвентаризациям"""
    try:
        from sqlalchemy import func, case
        from app.models.daily_inventory_v2 import DailyInventoryV2

        # Базовый запрос
        query = select(
            func.count(DailyInventoryV2.id).label('total'),
            func.count(
                case(
                    (DailyInventoryV2.shift_type == 'morning', 1),
                    else_=None
                )
            ).label('morning_shifts'),
            func.count(
                case(
                    (DailyInventoryV2.shift_type == 'night', 1),
                    else_=None
                )
            ).label('night_shifts')
        )

        if location:
            query = query.where(DailyInventoryV2.location == location)

        result = await db.execute(query)
        stats = result.fetchone()

        return {
            "total_inventories": stats.total,
            "morning_shifts": stats.morning_shifts,
            "night_shifts": stats.night_shifts,
            "location_filter": location
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения статистики: {str(e)}"
        )