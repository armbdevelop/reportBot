from datetime import datetime, date

from fastapi import APIRouter, status, Form, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, desc, select, func
from app.crud import ReportOnGoodCRUD
from app.schemas import ReportOnGoodsCreate, ReportOnGoodsResponse, KuxnyaJson, BarJson, UpakovkyJson
from typing import Optional, List
import json
from app.core import get_db
from app.models import ReportOnGoods

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
repg = ReportOnGoodCRUD()


@router.post(
    "/create",
    response_model=ReportOnGoodsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать отчет приема товаров",
    description="""
    Создает отчет о приеме товаров по категориям: кухня, бар, упаковки/хозтовары.

    ## Структура данных
    Каждая категория принимается как JSON массив с объектами вида:
    `{"name": "Название товара", "count": количество, "unit": "единица измерения"}`

    ## Категории:
    - **Кухня** (kuxnya_json): продукты для приготовления блюд
    - **Бар** (bar_json): напитки и сопутствующие товары  
    - **Упаковки/хоз** (upakovki_json): упаковочные материалы и хозтовары
    """,
    responses={
        201: {
            "description": "Отчет успешно создан",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "location": "Кафе Центральный",
                        "date": "2025-05-28T10:30:00Z",
                        "kuxnya": [{"name": "Мука", "count": 10, "unit": "кг"}],
                        "bar": [{"name": "Кола", "count": 24, "unit": "шт"}],
                        "upakovki": [{"name": "Стаканы", "count": 100, "unit": "шт"}]
                    }
                }
            }
        },
        400: {
            "description": "Ошибка валидации данных",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_json": {
                            "summary": "Некорректный JSON",
                            "value": {"detail": "Некорректный JSON в kuxnya_json"}
                        },
                        "missing_fields": {
                            "summary": "Отсутствующие поля",
                            "value": {"detail": "Каждый элемент должен содержать 'name', 'count' и 'unit'"}
                        },
                        "negative_count": {
                            "summary": "Отрицательное количество",
                            "value": {"detail": "Количество товара должно быть положительным числом"}
                        }
                    }
                }
            }
        }
    }
)
async def create_report_on_goods(
        location: str = Form(
            ...,
            description="Название локации",
            example="Кафе Центральный",
            min_length=1,
            max_length=255
        ),
        kuxnya_json: Optional[str] = Form(
            default=None,
            description="""JSON массив товаров для кухни.

Каждый элемент должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Мука пшеничная", "count": 5, "unit": "кг"}, {"name": "Масло подсолнечное", "count": 3, "unit": "л"}]""",
            example='[{"name": "Мука пшеничная", "count": 5, "unit": "кг"}, {"name": "Масло подсолнечное", "count": 3, "unit": "л"}]'
        ),

        bar_json: Optional[str] = Form(
            default=None,
            description="""JSON массив товаров для бара.

Каждый элемен�� должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Кола 0.5л", "count": 24, "unit": "шт"}, {"name": "Сок яблочный", "count": 12, "unit": "шт"}]""",
            example='[{"name": "Кола 0.5л", "count": 24, "unit": "шт"}, {"name": "Сок яблочный", "count": 12, "unit": "шт"}]'
        ),

        upakovki_json: Optional[str] = Form(
            default=None,
            description="""JSON массив упаковочных материалов и хозтоваров.

Каждый элемент должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Стаканы пластиковые", "count": 100, "unit": "шт"}, {"name": "Салфетки", "count": 50, "unit": "упаковка"}]""",
            example='[{"name": "Стаканы пластиковые", "count": 100, "unit": "шт"}, {"name": "Салфетки", "count": 50, "unit": "упаковка"}]'
        ),
        photos: Optional[List[UploadFile]] = File(None, description="Фотографии товаров/накладных"),
        shift_type: str = Form(..., regex="^(morning|night)$", description="Тип смены", example="morning"),
        cashier_name: str = Form(..., description="ФИО кассира", example="Иванов Иван"),
        db: AsyncSession = Depends(get_db),
) -> ReportOnGoodsResponse:
    """
    Создать отчет приема товаров.

    ## Назначение
    Этот эндпоинт используется для создания отчетов о поступлении товаров на склад с разбивкой по категориям.

    ## Категории товаров

    ### Кухня (kuxnya_json)
    Продукты и ингредиенты для приготовления блюд:
    - Мука, крупы, макароны
    - Масла, соусы, специи
    - Мясо, птица, рыба
    - Овощи, фрукты
    - Молочные продукты

    ### Бар (bar_json)
    Напитки и сопутствующие товары:
    - Безалкогольные напитки
    - Соки, воды
    - Кофе, чай
    - Сиропы, топпинги

    ### Упаковки/Хозтовары (upakovki_json)
    Упаковочные материалы и расходники:
    - Одноразовая посуда
    - Пакеты, контейнеры
    - Салфетки, полотенца
    - Моющие средства

    ## Формат JSON
    Все категории принимают массив объектов с поля��и:
    - `name`: название товара (обязательно)
    - `count`: количество штук (обязательно, > 0)
    - `unit`: единица измерения (обязательно)
    """
    try:
        # Парсим товары для кухни
        kuxnya_list = []
        if kuxnya_json:
            try:
                kuxnya_data = json.loads(kuxnya_json)
                if not isinstance(kuxnya_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="kuxnya_json должен быть массивом JSON"
                    )

                for item in kuxnya_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент кухни должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    kuxnya_list.append(KuxnyaJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в kuxnya_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации товаров кухни: {str(e)}"
                )

        # Парсим товары для бара
        bar_list = []
        if bar_json:
            try:
                bar_data = json.loads(bar_json)
                if not isinstance(bar_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="bar_json должен быть массивом JSON"
                    )

                for item in bar_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент бара должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    bar_list.append(BarJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в bar_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации товаров бара: {str(e)}"
                )

        # Парсим упаковки/хозтовары
        upakovky_list = []
        if upakovki_json:
            try:
                upakovki_data = json.loads(upakovki_json)
                if not isinstance(upakovki_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="upakovki_json должен быть массивом JSON"
                    )

                for item in upakovki_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент упаковок должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    upakovky_list.append(UpakovkyJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в upakovki_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации упаковок: {str(e)}"
                )

        # Создаем отчет
        report_on_goods_data = ReportOnGoodsCreate(
            location=location,
            kuxnya=kuxnya_list,
            bar=bar_list,
            upakovki=upakovky_list,
            shift_type=shift_type,
            cashier_name=cashier_name
        )

        photos_data = []
        if photos:
            for photo in photos:
                content = await photo.read()
                photos_data.append({
                    "filename": photo.filename,
                    "content": content,
                    "content_type": photo.content_type
                })

        return await repg.create_report_on_good(db, report_on_goods_data, photos=photos_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ошибка при создании отчета приема товаров: {str(e)}',
        )


@router.post(
    '/send-photo',
    status_code=status.HTTP_201_CREATED,
    description="ОТПРАВКА НЕ ДОСТАЮЩИХ ФОТО В ОТЧЕТ ПРИЕМА ТОВАРА",
    responses={201: {"Успешно отправлено": "статус - 201"},
               401: {"Плохой запро��": "статус 400 что то пошло не так"}}

)
async def send_photo(
        location: str = Form(
            ...,
            description="Название локации",
            example="Кафе Центральный",
            min_length=1,
            max_length=255
        ),

        photos: List[UploadFile] = File(None),
):
    try:
        photos_data = []
        for photo in photos:
            # Проверяем тип файла
            if not photo.content_type or not photo.content_type.startswith('image/'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Файл {photo.filename} не является изображением"
                )

            content = await photo.read()

            # Проверяем размер файла (максимум 20MB)
            if len(content) > 20 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Файл {photo.filename} слишком большой (ма��симум 20MB)"
                )

            photos_data.append({
                "filename": photo.filename,
                "content": content,
                "content_type": photo.content_type
            })

        return await repg.send_photo(location, photos_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail=str(e))


@router.get(
    "/list",
    summary="Получить список отчетов приема товаров",
    description="Возвращает список отчетов приема товаров с пагинацией и фильтрацией по дате и локации"
)
async def get_receiving_reports_list(
    start_date: Optional[date] = Query(None, description="Дата начала периода (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Дата окончания периода (YYYY-MM-DD)"),
    location: Optional[str] = Query(None, description="Фильтр по локации"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(10, ge=1, le=100, description="Количество элементов на странице"),
    db: AsyncSession = Depends(get_db)
):
    """
    Получает список отчетов приема товаров с пагинацией и фильтрацией.
    """
    try:
        # Условия фильтрации
        conditions = []

        if start_date:
            start_datetime = datetime.combine(start_date, datetime.min.time())
            conditions.append(ReportOnGoods.date >= start_datetime)

        if end_date:
            end_datetime = datetime.combine(end_date, datetime.max.time())
            conditions.append(ReportOnGoods.date <= end_datetime)

        if location:
            norm_loc = normalize_location(location)
            if norm_loc:
                conditions.append(ReportOnGoods.location == norm_loc)

        # Подсчет общего количества
        count_stmt = select(func.count(ReportOnGoods.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_result = await db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        # Пагинация
        offset = (page - 1) * per_page

        # Основной запрос
        stmt = select(ReportOnGoods)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(ReportOnGoods.date)).offset(offset).limit(per_page)

        result = await db.execute(stmt)
        reports = result.scalars().all()

        # Формируем ответ
        reports_list = []
        for report in reports:
            # Подсчитываем общее количество товаров
            goods_count = 0
            total_items = []

            # Обрабатываем кухню
            kuxnya_items = []
            if report.kuxnya:
                for item in report.kuxnya:
                    kuxnya_items.append({
                        "name": item.get("name", ""),
                        "count": item.get("count", 0),
                        "unit": item.get("unit", "")
                    })
                goods_count += len(report.kuxnya)
                total_items.extend(kuxnya_items)

            # Обрабатываем бар
            bar_items = []
            if report.bar:
                for item in report.bar:
                    bar_items.append({
                        "name": item.get("name", ""),
                        "count": item.get("count", 0),
                        "unit": item.get("unit", "")
                    })
                goods_count += len(report.bar)
                total_items.extend(bar_items)

            # Обрабатываем упаковки/хоз
            upakovki_items = []
            if report.upakovki_xoz:
                for item in report.upakovki_xoz:
                    upakovki_items.append({
                        "name": item.get("name", ""),
                        "count": item.get("count", 0),
                        "unit": item.get("unit", "")
                    })
                goods_count += len(report.upakovki_xoz)
                total_items.extend(upakovki_items)

            reports_list.append({
                "id": report.id,
                "location": report.location,
                "cashier_name": report.cashier_name,
                "shift_type": report.shift_type,
                "goods_count": goods_count,
                "supplier": getattr(report, 'supplier', None),
                "created_at": report.date.isoformat() if report.date else None,
                "kuxnya": kuxnya_items,
                "bar": bar_items,
                "upakovki": upakovki_items,
                "total_items": total_items
            })

        return {
            "reports": reports_list,
            "total": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": (total_count + per_page - 1) // per_page
        }

    except Exception as e:
        print(f"❌ Ошибка получения списка отчетов приема товаров: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения списка отчетов"
        )


@router.get(
    "/{report_id}",
    summary="Получить отчет приема товаров по ID",
    description="Возвращает детальную информацию об отчете приема тов��ров"
)
async def get_receiving_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Получает детальную информацию об отчете приема товаров по ID.
    """
    try:
        report = await db.get(ReportOnGoods, report_id)

        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Отчет не найден"
            )

        return {
            "id": report.id,
            "location": report.location,
            "cashier_name": report.cashier_name,
            "shift_type": report.shift_type,
            "kuxnya": report.kuxnya if report.kuxnya else [],
            "bar": report.bar if report.bar else [],
            "upakovki": report.upakovki_xoz if report.upakovki_xoz else [],
            "photos_urls": report.photos_urls if hasattr(report, 'photos_urls') else [],
            "supplier": getattr(report, 'supplier', None),
            "created_at": report.date.isoformat() if report.date else None,
            "updated_at": None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ошибка получения отчета приема товаров: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка получения отчета"
        )
