"""
Скрипт для автоматической очистки старых записей из базы данных.
Запускается каждый день в 00:00 и удаляет записи старше 90 дней.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import DatabaseHelper
from app.models import ShiftReport, ReportOnGoods
from app.models.daily_inventory import DailyInventory
from app.models.daily_inventory_v2 import DailyInventoryV2
from app.models.writeoff_transfer import WriteOffReport, TransferReport

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cleanup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Инициализация базы данных
database_url = f"{settings.DB_DRIVER}://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
db_helper = DatabaseHelper(
    url=database_url,
    echo=settings.DB_ECHO,
    echo_pool=settings.DB_ECHO_POOL,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_size=settings.DB_POOL_SIZE,
)


async def cleanup_old_records() -> None:
    """
    Удаляет записи старше 90 дней из всех таблиц отчетов.
    """
    cutoff_date = datetime.now() - timedelta(days=90)
    logger.info(f"Начинаем очистку записей старше {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")
    
    async for session in db_helper.session_getter():
        try:
            # Список моделей для очистки
            models_to_clean = [
                (ShiftReport, 'shift_reports', 'created_at'),
                (ReportOnGoods, 'reportongoods', 'date'),
                (DailyInventory, 'dailyinventory', 'created_at'),
                (DailyInventoryV2, 'dailyinventoryv2', 'created_at'),
                (WriteOffReport, 'writeoffreport', 'created_at'),
                (TransferReport, 'transferreport', 'created_at'),
            ]
            
            total_deleted = 0
            
            for model, table_name, date_field in models_to_clean:
                try:
                    # Подсчитываем количество записей для удаления
                    count_query = text(f"""
                        SELECT COUNT(*) 
                        FROM {table_name} 
                        WHERE {date_field} < :cutoff_date
                    """)
                    
                    result = await session.execute(count_query, {"cutoff_date": cutoff_date})
                    count_to_delete = result.scalar()
                    
                    if count_to_delete > 0:
                        # Удаляем старые записи
                        delete_query = text(f"""
                            DELETE FROM {table_name} 
                            WHERE {date_field} < :cutoff_date
                        """)
                        
                        await session.execute(delete_query, {"cutoff_date": cutoff_date})
                        
                        logger.info(f"Удалено {count_to_delete} записей из таблицы {table_name}")
                        total_deleted += count_to_delete
                    else:
                        logger.info(f"В таблице {table_name} нет записей для удаления")
                        
                except Exception as e:
                    logger.error(f"Ошибка при очистке таблицы {table_name}: {str(e)}")
                    continue
            
            # Подтверждаем изменения
            await session.commit()
            logger.info(f"Очистка завершена. Всего удалено записей: {total_deleted}")
            
        except Exception as e:
            logger.error(f"Критическая ошибка при очистке базы данных: {str(e)}")
            await session.rollback()
            raise
        
        finally:
            await session.close()


async def cleanup_old_files() -> None:
    """
    Удаляет старые файлы из директории uploads.
    """
    import os
    import glob
    from pathlib import Path
    
    logger.info("Начинаем очистку старых файлов")
    
    cutoff_timestamp = (datetime.now() - timedelta(days=90)).timestamp()
    uploads_dir = Path("uploads")
    
    if not uploads_dir.exists():
        logger.warning("Директория uploads не найдена")
        return
    
    total_deleted_files = 0
    
    # Перебираем все поддиректории в uploads
    for subdir in uploads_dir.iterdir():
        if subdir.is_dir():
            # Ищем все файлы в поддиректории
            for file_path in subdir.glob("*"):
                if file_path.is_file():
                    try:
                        # Проверяем дату модификации файла
                        if file_path.stat().st_mtime < cutoff_timestamp:
                            file_path.unlink()  # Удаляем файл
                            logger.info(f"Удален файл: {file_path}")
                            total_deleted_files += 1
                    except Exception as e:
                        logger.error(f"Ошибка при удалении файла {file_path}: {str(e)}")
    
    logger.info(f"Очистка файлов завершена. Удалено файлов: {total_deleted_files}")


async def daily_cleanup_task() -> None:
    """
    Основная задача ежедневной очистки.
    """
    logger.info("=" * 50)
    logger.info("ЗАПУСК ЕЖЕДНЕВНОЙ ОЧИСТКИ")
    logger.info("=" * 50)
    
    try:
        # Очищаем записи в базе данных
        await cleanup_old_records()
        
        # Очищаем старые файлы
        await cleanup_old_files()
        
        logger.info("Ежедневная очистка выполнена успешно")
        
    except Exception as e:
        logger.error(f"Ошибка при выполнении ежедневной очистки: {str(e)}")
    
    finally:
        logger.info("=" * 50)
        logger.info("ЗАВЕРШЕНИЕ ЕЖЕДНЕВНОЙ ОЧИСТКИ")
        logger.info("=" * 50)


def start_cleanup_scheduler() -> AsyncIOScheduler:
    """
    Запускает планировщик задач для автоматической очистки.
    """
    scheduler = AsyncIOScheduler()
    
    # Добавляем задачу, которая будет выполняться каждый день в 00:00
    scheduler.add_job(
        func=daily_cleanup_task,
        trigger=CronTrigger(hour=0, minute=0, second=0),  # Каждый день в полночь
        id='daily_cleanup',
        name='Ежедневная очистка старых записей',
        replace_existing=True,
        max_instances=1,  # Только одна задача может выполняться одновременно
    )
    
    # Также можно добавить задачу для тестирования (раскомментируйте при необходимости)
    # scheduler.add_job(
    #     func=daily_cleanup_task,
    #     trigger=CronTrigger(minute='*/5'),  # Каждые 5 минут для тестирования
    #     id='test_cleanup',
    #     name='Тестовая очистка',
    #     replace_existing=True,
    # )
    
    logger.info("Планировщик очистки настроен")
    return scheduler


async def main():
    """
    Основная функция для запуска планировщика.
    """
    logger.info("Запуск службы автоматической очистки базы данных")
    
    # Создаем и запускаем планировщик
    scheduler = start_cleanup_scheduler()
    scheduler.start()
    
    logger.info("Планировщик запущен. Ожидание задач...")
    logger.info("Следующая очистка запланирована на 00:00")
    
    try:
        # Если хотите запустить очистку сразу для тестирования, раскомментируйте:
        # logger.info("Запуск тестовой очистки...")
        # await daily_cleanup_task()
        
        # Держим программу запущенной
        while True:
            await asyncio.sleep(3600)  # Проверяем каждый час
            
    except KeyboardInterrupt:
        logger.info("Получен сигнал остановки")
    except Exception as e:
        logger.error(f"Неожиданная ошибка: {str(e)}")
    finally:
        logger.info("Остановка планировщика...")
        scheduler.shutdown()
        await db_helper.dispose()
        logger.info("Служба очистки остановлена")


if __name__ == "__main__":
    asyncio.run(main())
