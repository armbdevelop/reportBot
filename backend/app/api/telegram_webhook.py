from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.telegram import TelegramUpdate
from app.services import TelegramService
from app.core import get_db
import json

router = APIRouter()
telegram_service = TelegramService()


@router.post("/webhook", summary="Telegram webhook endpoint")
async def telegram_webhook(
        update: TelegramUpdate,
        db: AsyncSession = Depends(get_db)
):
    """
    Обработчик веб-хуков от Telegram.

    Принимает обновления от Telegram API и обрабатывает команды пользователей.
    """
    try:
        # Обрабатываем сообщение
        if update.message:
            await telegram_service.handle_message(update.message, db)

        # Обрабатываем callback query (нажатия на inline кнопки)
        if update.callback_query:
            await telegram_service.handle_callback_query(update.callback_query, db)

        return {"ok": True}

    except Exception as e:
        print(f"❌ Ошибка обработки webhook: {str(e)}")
        # Возвращаем OK чтобы Telegram не повторял запрос
        return {"ok": True}


@router.get("/webhook/info", summary="Получить информацию о веб-хуке")
async def get_webhook_info():
    """
    Получает текущую информацию о настроенном веб-хуке.
    """
    try:
        info = await telegram_service.get_webhook_info()
        return {"success": True, "data": info}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/webhook/set", summary="Установить веб-хук")
async def set_webhook(request: Request):
    """
    Устанавливает веб-хук для Telegram бота.
    """
    try:
        # Получаем базовый URL из запроса
        base_url = f"{request.url.scheme}://{request.headers.get('host')}"
        webhook_url = f"{base_url}/telegram/webhook"

        success = await telegram_service.set_webhook(webhook_url)

        if success:
            return {"success": True, "webhook_url": webhook_url}
        else:
            return {"success": False, "error": "Не удалось установить веб-хук"}

    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/webhook", summary="Удалить веб-хук")
async def delete_webhook():
    """
    Удаляет веб-хук Telegram бота.
    """
    try:
        success = await telegram_service.delete_webhook()

        if success:
            return {"success": True, "message": "Веб-хук удален"}
        else:
            return {"success": False, "error": "Не удалось удалить веб-хук"}

    except Exception as e:
        return {"success": False, "error": str(e)}