# 🚀 Полная инструкция деплоя ReportBot

## ВАЖНО!
Необходимо заменить все упоминания

`ВАШ_ТОКЕН`

`ВАШ_ДОМЕН`

на соответсвующие. они встреяются во многих файлах

## 1. Подготовка сервера

### Обновление системы и установка зависимостей

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем необходимые пакеты
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx nodejs npm

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезайдите в систему для применения группы docker
exit
```

### Клонирование проекта

```bash
cd /root
git clone https://github.com/mixelka75/reportBot.git
cd reportBot
```

## 2. Получение SSL сертификата

```bash
# Останавливаем nginx если запущен
sudo systemctl stop nginx

# Получаем сертификат
sudo certbot certonly --standalone -d ВАШ_ДОМЕН

# Проверяем, что сертификат получен
sudo ls -la /etc/letsencrypt/live/ВАШ_ДОМЕН/
```

## 3. Настройка Nginx

### Создание файла паролей для защищенных страниц

```bash
# Устанавливаем утилиту для создания паролей
sudo apt install -y apache2-utils

# Создаем файл с паролем для страницы просмотра отчетов
# Используем фиксированное имя пользователя (любое), вам нужно будет ввести только пароль
# При входе на страницу потребуется ввести только пароль (логин можно оставить пустым или любой)
sudo htpasswd -c /etc/nginx/.htpasswd user

# Проверяем, что файл создан
sudo cat /etc/nginx/.htpasswd
```

### Создание конфигурации

```bash
sudo nano /etc/nginx/sites-available/ВАШ_ДОМЕН
```

**Содержимое файла:**

```nginx
# /etc/nginx/sites-available/report.dg05.ru

server {
    if ($host = report.dg05.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name report.dg05.ru;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;


}

server {
    listen 443 ssl http2;
    server_name report.dg05.ru;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/report.dg05.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/report.dg05.ru/privkey.pem; # managed by Certbot
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Безопасность
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Настройки клиента
    client_max_body_size 50M;
    
    # Логи
    access_log /var/log/nginx/miniapp-reportbot_access.log;
    error_log /var/log/nginx/miniapp-reportbot_error.log;

    # Сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # API роуты - проксируем на бэкенд FastAPI
    location ~ ^/(shift-reports|daily_inventory|report-on-goods|writeoff-transfer|telegram|docs|openapi\.json|redoc|health|inventory-management|daily-inventory-v2) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Для больших файлов (фото отчетов)
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        
        # CORS заголовки для API
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
        
        # Обработка preflight запросов
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # Статические файлы (загруженные фото)
    location /uploads/ {
        alias /root/reportBot/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin * always;
    }

    # React приложение (фронтенд)
    location / {
        root /root/reportBot/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Защита паролем для страницы просмотра отчетов
        location ~ ^/otchet/views {
            root /root/reportBot/frontend/dist;
            try_files $uri $uri/ /index.html;
            
            # Базовая HTTP аутентификация
            auth_basic "Доступ к просмотру отчетов";
            auth_basic_user_file /etc/nginx/.htpasswd;
        }
        
        # Кеширование для статических файлов
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Access-Control-Allow-Origin * always;
        }
        
        # Для HTML файлов не кешируем
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
        }
    }

}

```

### Настройка nginx для работы от root

```bash
sudo nano /etc/nginx/nginx.conf
```

Найдите в начале файла строку:
```nginx
user www-data;
```

И замените её на:
```nginx
user root;
```

### Активация сайта

```bash
# Активируем сайт
sudo ln -s /etc/nginx/sites-available/ВАШ_ДОМЕН /etc/nginx/sites-enabled/

# Удаляем дефолтный сайт
sudo rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
sudo nginx -t

# Запускаем nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 4. Создание файлов проекта

### .env (корень проекта)

```bash
nano .env
```

**Содержимое:**

```bash
DB_USER=botbd
DB_PASSWORD=passwordbot
DB_NAME=botbd
```

### backend/app/.prod.env

```bash
nano backend/app/.prod.env
```

**Содержимое:**

```bash
# Database
DB_HOST=db
DB_PORT=5432
DB_USER=botbd
DB_PASSWORD=passwordbot
DB_NAME=botbd
DB_DRIVER=postgresql+asyncpg
DB_ECHO=false
DB_ECHO_POOL=false
DB_MAX_OVERFLOW=20
DB_POOL_SIZE=10

# Telegram
TELEGRAM_BOT_TOKEN=ВАШ_ТОКЕН
TELEGRAM_CHAT_ID=-1002651441397

# Telegram Topic IDs (подгруппы)
GAGARINA_48_TOPIC_ID=2
ABDULHAMID_51_TOPIC_ID=94
GAIDAR_7B_TOPIC_ID=56

# URLs
MINI_APP_URL=https://ВАШ_ДОМЕН
WEBHOOK_URL=https://ВАШ_ДОМЕН/telegram/webhook
WEBHOOK_SECRET_TOKEN=ВАШ_ТОКЕН
```

### frontend/.env.production

```bash
nano frontend/.env.production
```

**Содержимое:**

```bash
VITE_API_BASE_URL=https://ВАШ_ДОМЕН
NODE_ENV=production
```

### docker-compose.prod.yml

```bash
nano docker-compose.prod.yml
```

**Содержимое:**

```yaml
version: '3.8'

services:
  db:
    image: postgres:17
    container_name: reportbot_db
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-backup:/backup
    restart: unless-stopped
    shm_size: 128mb
    expose:
      - "5432"
    networks:
      - reportbot_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: reportbot_backend
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - ./backend/app/.prod.env
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    environment:
      - UVICORN_RELOAD=false
      - UVICORN_WORKERS=4
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - reportbot_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres_data:

networks:
  reportbot_network:
    driver: bridge
```

### deploy.sh

```bash
nano deploy.sh
```

**Содержимое:**

```bash
#!/bin/bash

set -e

echo "🚀 Начинаем деплой ReportBot..."

DOMAIN="ВАШ_ДОМЕН"

if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Ошибка: Запустите скрипт из корня проекта ReportBot"
    exit 1
fi

echo "📦 Обновляем код..."
git pull origin main

echo "🏗️  Собираем фронтенд..."
cd frontend
npm install
npm run build
cd ..

echo "🐳 Останавливаем старые контейнеры..."
docker-compose -f docker-compose.prod.yml down

echo "🔨 Собираем Docker образы..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🗂️  Создаем необходимые директории..."
mkdir -p uploads/shift_reports
mkdir -p logs
mkdir -p postgres-backup

echo "🔐 Устанавливаем права доступа..."
chmod -R 755 uploads

echo "🚀 Запускаем новые контейнеры..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Ждем запуска сервисов..."
sleep 30

echo "🔄 Перезагружаем nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "🏥 Проверяем здоровье сервисов..."
echo "Backend: $(curl -s http://localhost:8000/health || echo 'FAIL')"
echo "Frontend: $(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN || echo 'FAIL')"

echo "📊 Состояние контейнеров:"
docker-compose -f docker-compose.prod.yml ps

echo "📝 Логи (последние 20 строк):"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo "✅ Деплой завершен!"
echo "🌐 Приложение доступно по адресу: https://$DOMAIN"
echo "📚 API документация: https://$DOMAIN/docs"

echo ""
echo "🔍 Полезные команды для мониторинга:"
echo "  Логи бэкенда:    docker-compose -f docker-compose.prod.yml logs -f backend"
echo "  Логи БД:         docker-compose -f docker-compose.prod.yml logs -f db"
echo "  Статус:          docker-compose -f docker-compose.prod.yml ps"
echo "  Перезапуск:      docker-compose -f docker-compose.prod.yml restart"
```

```bash
chmod +x deploy.sh
```

## 5. Обновление vite.config.js

```bash
nano frontend/vite.config.js
```

**Содержимое:**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            lucide: ['lucide-react']
          }
        }
      }
    },
    define: {
      'process.env': {}
    }
  }
})
```

## 6. Настройка автообновления SSL сертификата

```bash
# Добавляем задание в cron
sudo crontab -e

# Добавьте эту строку:
0 12 * * * /usr/bin/certbot renew --quiet --reload-nginx
```

## 7. Деплой приложения

```bash
./deploy.sh
```

## 8. Настройка Telegram webhook

```bash
# Устанавливаем webhook
curl -X POST "https://api.telegram.org/botВАШ_ТОКЕН/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ВАШ_ДОМЕН/telegram/webhook"}'

# Проверяем webhook
curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"
```

## 9. Полезные команды

```bash
# Логи в реальном времени
docker-compose -f docker-compose.prod.yml logs -f backend

# Перезапуск сервиса
docker-compose -f docker-compose.prod.yml restart backend

# Бэкап БД
docker-compose -f docker-compose.prod.yml exec db pg_dump -U botbd botbd > backup.sql

# Обновление приложения
git pull origin main
./deploy.sh

# Статус nginx
sudo systemctl status nginx
sudo nginx -t

# Просмотр логов nginx
sudo tail -f /var/log/nginx/miniapp-reportbot_error.log
sudo tail -f /var/log/nginx/miniapp-reportbot_access.log
```

## 10. Тестирование в Telegram

1. Найдите вашего бота в Telegram
2. Напишите команду `/start`
3. Бот должен ответить с меню
4. Попробуйте создать тестовый отчет

## 🎉 Готово!

После выполнения всех шагов ваше приложение ReportBot будет доступно:

- **🌐 Приложение:** https://ВАШ_ДОМЕН
- **📚 API документация:** https://ВАШ_ДОМЕН/docs
- **🔄 Redoc:** https://ВАШ_ДОМЕН/redoc
- **❤️ Health check:** https://ВАШ_ДОМЕН/health

## Устранение неполадок

### Если фронтенд не открывается (403/404):
1. Проверьте, что фронтенд собран: `ls -la frontend/dist/`
2. Проверьте права доступа: `chmod -R 755 frontend/dist/`
3. Проверьте nginx работает от root: `ps aux | grep nginx`

### Если API не работает:
1. Проверьте логи бэкенда: `docker-compose -f docker-compose.prod.yml logs backend`
2. Проверьте healthcheck: `curl http://localhost:8000/health`
3. Проверьте переменные окружения в `.prod.env`

### Если Telegram не работает:
1. Проверьте webhook: `curl "https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo"`
2. Проверьте токен и chat_id в `.prod.env`
3. Проверьте логи при отправке сообщения боту