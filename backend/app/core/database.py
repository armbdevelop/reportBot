from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncEngine,
    async_sessionmaker,
    AsyncSession,
)

from app.core.config import settings


class DatabaseHelper:
    def __init__(
        self,
        url: str,
        echo: bool = False,
        echo_pool: bool = False,
        max_overflow: int = 10,
        pool_size: int = 20,
    ) -> None:
        """
        Инициализирует новый экземпляр DatabaseHelper с указанными параметрами подключения.

        :param url: URL базы данных для подключения
        :param echo: Логировать SQL-запросы в stdout
        :param echo_pool: Логировать запросы из пула соединений
        :param max_overflow: Максимальное количество соединений сверх pool_size,
                             которые могут быть установлены с базой данных
        :param pool_size: Количество соединений в пуле, которые могут использоваться
                         одновременно
        """
        self.engine: AsyncEngine = create_async_engine(
            url=url,
            echo=echo,
            echo_pool=echo_pool,
            max_overflow=max_overflow,
            pool_size=pool_size,
        )
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    async def dispose(self) -> None:
        """Закрывает все соединения и освобождает ресурсы движка базы данных"""
        await self.engine.dispose()

    async def session_getter(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Асинхронный генератор сессий базы данных.

        :return: Асинхронный итератор, возвращающий сессии базы данных
        """
        async with self.session_factory() as session:
            yield session


# Создание экземпляра DatabaseHelper с настройками из конфигурации
db_helper = DatabaseHelper(
    url=str(settings.db_url),
    echo=settings.DB_ECHO,
    echo_pool=settings.DB_ECHO_POOL,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_size=settings.DB_POOL_SIZE,
)


async def get_db():
    async for session in db_helper.session_getter():
        yield session