import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.services import TelegramService
from app.core.config import settings
import asyncio

app = FastAPI(
    title="ReportBot API",
    description="API для создания отчетов кафе с интеграцией Telegram",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем API роуты
app.include_router(api_router)

# Подключаем загрузки
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
async def startup_event():
    """Событие запуска приложения"""
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

    print("✅ ReportBot API запущен успешно!")




if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, env_file='.dev.env')