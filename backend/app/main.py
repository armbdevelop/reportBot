from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.services import TelegramService
from app.core.config import settings
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text
from app.core.database import DatabaseHelper

# Настройка логирования
logging.basicConfig(level=logging.INFO)
cleanup_logger = logging.getLogger("cleanup")
cleanup_logger.setLevel(logging.INFO)

# Инициализация базы данных для очистки
database_url = f"{settings.DB_DRIVER}://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
db_helper = DatabaseHelper(
    url=database_url,
    echo=settings.DB_ECHO,
    echo_pool=settings.DB_ECHO_POOL,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_size=settings.DB_POOL_SIZE,
)

# Глобальная переменная для планировщика
scheduler = None


async def cleanup_old_records() -> None:
    """Удаляет записи старше 90 дней из всех таблиц отчетов."""
    cutoff_date = datetime.now() - timedelta(days=90)
    cleanup_logger.info(f"🧹 Начинаем очистку записей старше {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")

    async for session in db_helper.session_getter():
        try:
            models_to_clean = [
                ('shift_reports', 'created_at'),
                ('reportongoods', 'date'),
                ('dailyinventory', 'created_at'),
                ('dailyinventoryv2', 'created_at'),
                ('writeofftransfer', 'created_at'),
                ('shift_reports', 'created_at'),
            ]

            total_deleted = 0

            for table_name, date_field in models_to_clean:
                try:
                    # Подсчитываем количество записей для удаления
                    count_query = text(f"SELECT COUNT(*) FROM {table_name} WHERE {date_field} < :cutoff_date")
                    result = await session.execute(count_query, {"cutoff_date": cutoff_date})
                    count_to_delete = result.scalar()

                    if count_to_delete > 0:
                        # Удаляем старые записи
                        delete_query = text(f"DELETE FROM {table_name} WHERE {date_field} < :cutoff_date")
                        await session.execute(delete_query, {"cutoff_date": cutoff_date})
                        cleanup_logger.info(f"🗑️ Удалено {count_to_delete} записей из таблицы {table_name}")
                        total_deleted += count_to_delete
                    else:
                        cleanup_logger.info(f"✅ В таблице {table_name} нет записей для удаления")

                except Exception as e:
                    cleanup_logger.error(f"❌ Ошибка при очистке таблицы {table_name}: {str(e)}")
                    continue

            await session.commit()
            cleanup_logger.info(f"✅ Очистка завершена. Всего удалено записей: {total_deleted}")

        except Exception as e:
            cleanup_logger.error(f"❌ Критическая ошибка при очистке базы данных: {str(e)}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def cleanup_old_files() -> None:
    """Удаляет старые файлы из директории uploads."""
    from pathlib import Path

    cleanup_logger.info("🧹 Начинаем очистку старых файлов")

    cutoff_timestamp = (datetime.now() - timedelta(days=90)).timestamp()
    uploads_dir = Path("uploads")

    if not uploads_dir.exists():
        cleanup_logger.warning("⚠️ Директория uploads не найдена")
        return

    total_deleted_files = 0

    for subdir in uploads_dir.iterdir():
        if subdir.is_dir():
            for file_path in subdir.glob("*"):
                if file_path.is_file():
                    try:
                        if file_path.stat().st_mtime < cutoff_timestamp:
                            file_path.unlink()
                            cleanup_logger.info(f"🗑️ Удален файл: {file_path}")
                            total_deleted_files += 1
                    except Exception as e:
                        cleanup_logger.error(f"❌ Ошибка при удалении файла {file_path}: {str(e)}")

    cleanup_logger.info(f"✅ Очистка файлов завершена. Удалено файлов: {total_deleted_files}")


async def daily_cleanup_task() -> None:
    """Основная задача ежедневной очистки."""
    cleanup_logger.info("🔄 ЗАПУСК ЕЖЕДНЕВНОЙ ОЧИСТКИ")

    try:
        await cleanup_old_records()
        await cleanup_old_files()
        cleanup_logger.info("✅ Ежедневная очистка выполнена успешно")
    except Exception as e:
        cleanup_logger.error(f"❌ Ошибка при выполнении ежедневной очистки: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    global scheduler

    # Startup
    print("🚀 Запуск ReportBot API...")

    # Инициализируем Telegram сервис
    telegram_service = TelegramService()

    # Устанавливаем веб-хук если задан URL
    if settings.WEBHOOK_URL:
        print(f"🔗 Установка веб-хука: {settings.WEBHOOK_URL}")
        success = await telegram_service.set_webhook(settings.WEBHOOK_URL)
        if success:
            print("✅ Веб-хук установлен успешно")
        else:
            print("❌ Ошибка установки веб-хука")
    else:
        print("⚠️  WEBHOOK_URL не задан, веб-хук не установлен")

    # Запускаем планировщик очистки
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        func=daily_cleanup_task,
        trigger=CronTrigger(hour=0, minute=0, second=0),  # Каждый день в полночь
        id='daily_cleanup',
        name='Ежедневная очистка старых записей',
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    print("🧹 Планировщик очистки запущен (ежедневно в 00:00)")

    print("✅ ReportBot API запущен успешно!")

    yield

    # Shutdown
    print("🛑 Остановка ReportBot API...")
    if scheduler:
        scheduler.shutdown()
        print("🧹 Планировщик очистки остановлен")

    await db_helper.dispose()
    print("✅ ReportBot API остановлен")


app = FastAPI(
    title="ReportBot API",
    description="API для создания отчетов кафе с интеграцией Telegram",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем API роуты с префиксом /api
app.include_router(api_router)

# Подключаем загрузки
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
