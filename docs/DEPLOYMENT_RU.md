# Деплой Near в production

Руководство по развёртыванию на VPS или dedicated-сервере в РФ (рекомендуется для 152-ФЗ / 242-ФЗ).

## Архитектура

```
Интернет → TLS (Caddy/nginx на хосте) → docker: web (nginx:80)
                                              ├─ /        → SPA (static)
                                              └─ /api/*   → backend:8000 (FastAPI)
                                                    ↓
                                              postgres + redis (internal)
```

- **Один домен** — фронтенд и API на одном origin (`/api`), CORS минимален.
- **PostgreSQL** — только внутри Docker-сети, порт наружу не публикуется.
- **Redis** — зарезервирован для фоновых задач (Celery/APScheduler).

## Требования

- Linux VPS (2 GB RAM минимум, 4 GB комфортнее)
- Docker Engine 24+ и Docker Compose v2
- Домен с DNS на IP сервера
- TLS-сертификат (Let's Encrypt)

## Быстрый старт (Docker Compose)

### 1. Клонировать репозиторий на сервер

```bash
git clone <repo-url> near && cd near
```

### 2. Создать файл секретов

```bash
cp .env.prod.example .env.prod
```

Обязательно замените:

| Переменная | Как получить |
|------------|--------------|
| `POSTGRES_PASSWORD` | Длинный случайный пароль |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `CORS_ORIGINS` | `https://ваш-домен.ru` |
| `TRUSTED_HOSTS` | `ваш-домен.ru` |
| `LEGAL_*` | Реквизиты оператора ПДн |

### 3. Собрать и запустить

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Проверка:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://127.0.0.1/api/health
```

Первый запуск backend автоматически выполняет `alembic upgrade head`.

### Локальная проверка образов (без домена)

В `.env.prod` временно:

```env
CORS_ORIGINS=http://localhost
TRUSTED_HOSTS=localhost
HTTP_PORT=8080
```

Затем откройте `http://localhost:8080`.

### 4. HTTPS (Caddy на хосте — рекомендуется)

Установите [Caddy](https://caddyserver.com/) на хост и проксируйте на `127.0.0.1:80`:

```caddy
ваш-домен.ru {
    reverse_proxy 127.0.0.1:80
}
```

Caddy сам получит Let's Encrypt. В `.env.prod` укажите `CORS_ORIGINS=https://ваш-домен.ru`.

### Альтернатива: TLS на nginx хоста

Если не используете Caddy — настройте certbot + nginx на хосте с `proxy_pass http://127.0.0.1:80`.

## PowerShell (Windows Server / dev-проверка образов)

```powershell
cd d:\Near
Copy-Item .env.prod.example .env.prod
# отредактируйте .env.prod
.\scripts\deploy-prod.ps1
```

## Обновление релиза

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Миграции применяются при старте контейнера `backend`.

## Бэкапы PostgreSQL

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U near near > backup_$(date +%Y%m%d).sql
```

Восстановление:

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U near -d near
```

Храните бэкапы **в РФ**, шифруйте при передаче.

## Мониторинг

| Проверка | URL / команда |
|----------|----------------|
| API health | `GET /api/health` |
| Контейнеры | `docker compose -f docker-compose.prod.yml ps` |
| Логи backend | `docker compose -f docker-compose.prod.yml logs -f backend` |

## Чеклист перед публичным запуском

- [ ] `JWT_SECRET` и `POSTGRES_PASSWORD` — уникальные, не из примера
- [ ] `ENV=production` (задаётся в compose)
- [ ] HTTPS включён
- [ ] PostgreSQL на сервере в РФ (или managed DB в РФ)
- [ ] Юридические документы и реквизиты — [LEGAL_COMPLIANCE_RU.md](./LEGAL_COMPLIANCE_RU.md)
- [ ] SMTP настроен (если нужны email-уведомления)
- [ ] Регламент бэкапов и инцидентов

## Переменные окружения

Полный шаблон: [`.env.prod.example`](../.env.prod.example).

Backend также читает `backend/.env` при локальном запуске без Docker — см. [`backend/.env.example`](../backend/.env.example).

## Масштабирование

Текущий compose рассчитан на **один инстанс** backend. Для нескольких:

- Вынести PostgreSQL и Redis в managed-сервисы
- Несколько реплик `backend` за балансировщиком
- Rate limiting перевести на Redis (сейчас in-memory)

## Связанные документы

| Документ | Тема |
|----------|------|
| [POSTGRES_MIGRATION.md](./POSTGRES_MIGRATION.md) | PostgreSQL, миграции |
| [LEGAL_COMPLIANCE_RU.md](./LEGAL_COMPLIANCE_RU.md) | 152-ФЗ, prod-инфраструктура |
| [BACKLOG.md](../BACKLOG.md) | Фоновые задачи, observability |
