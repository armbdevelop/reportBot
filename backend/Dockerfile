FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1

WORKDIR /app

COPY pyproject.toml poetry.lock ./

RUN poetry install --only=main --no-root

COPY app/ ./app/

ENV PYTHONPATH=/app

EXPOSE 8000

# Создаем папку для загрузок
RUN mkdir -p /app/uploads/shift_reports
VOLUME /app/uploads

# Создаем скрипт запуска
COPY <<EOF /app/start.sh
#!/bin/bash
set -e

echo "Ожидание базы данных..."
sleep 5

echo "Запуск миграций..."
cd /app/app
poetry run alembic upgrade head

echo "Запуск приложения..."
cd /app
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]