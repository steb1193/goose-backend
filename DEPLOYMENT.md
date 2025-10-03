# Развертывание и запуск бэкенда

**Репозиторий:** [git@github.com:steb1193/goose-backend.git](git@github.com:steb1193/goose-backend.git)

## Переменные окружения

Создайте файл `.env` в корне папки `backend` со следующими переменными:

```bash
# Сервер
GOOSE_API_PORT=3000                    # Порт HTTP API сервера
GOOSE_WS_PORT=3000                     # Порт WebSocket сервера (обычно тот же что и HTTP)
GOOSE_NODE_ENV=development             # production|development

# JWT
GOOSE_JWT_SECRET=supersecretkey        # Секрет для подписи JWT токенов
GOOSE_JWT_EXPIRES_IN=7d               # Время жизни JWT токена

# База данных PostgreSQL
GOOSE_DB_HOST=localhost               # Хост базы данных
GOOSE_DB_PORT=5433                   # Порт базы данных (по умолчанию в docker-compose.yml)
GOOSE_DB_NAME=goose_db               # Имя базы данных
GOOSE_DB_USER=goose_user             # Пользователь базы данных
GOOSE_DB_PASSWORD=goose_password      # Пароль базы данных

# Redis
GOOSE_REDIS_URL=redis://localhost:6379              # URL подключения к Redis
GOOSE_REDIS_KEY_PREFIX=goose:                      # Префикс для ключей Redis
GOOSE_REDIS_TTL=3600                               # TTL ключей в Redis (секунды)

# Настройки игры
COOLDOWN_DURATION=30            # Длительность cooldown в секундах (до начала раунда)
ROUND_DURATION=60              # Длительность раунда в секундах

# Throttling (защита от спама)
THROTTLE_WINDOW_MS=1000              # Окно throttling в миллисекундах
MAX_RETRIES=10                       # Максимальное количество запросов за окно
```

## Быстрый запуск

### 1. Подготовка

```bash
# Установка зависимостей
npm install

# Сгенерировать Prisma клиент (первый запуск)
npm run prisma:generate
```

### 2. Запуск docker-compose

```bash
# Запустить PostgreSQL и Redis
docker-compose up -d
```

### 3. Настройка базы данных

```bash
# Применить миграции
npm run prisma:migrate:dev

# Или создать схему без миграций (для разработки)
npm run db:push
```

### 4. Запуск приложения

```bash
# Разработка (с hot reload)
npm run start:dev

# Продакшн
npm run build
npm run start:prod
```

## Структура портов

- **3000** - HTTP API и WebSocket сервер
- **5433** - PostgreSQL (маппинг с 5432 в контейнере)
- **6379** - Redis

## Полезные команды

```bash
# Открыть Prisma Studio
npm run prisma:studio

# Сбросить базу данных
npm run prisma:reset

# Проверить подключение к базе
npm run db:push

# Линтинг и форматирование
npm run lint
npm run format
```

## Масштабирование

Приложение поддерживает горизонтальное масштабирование:
- Несколько инстансов могут работать с одной базой данных
- WebSocket использует Redis adapter для синхронизации между инстансами
- Все данные о состоянии игры хранятся в базе данных или Redis
