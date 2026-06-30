# План миграции SQLite → PostgreSQL

Near по умолчанию использует **SQLite** (`sqlite+aiosqlite`) для локальной разработки. Для production и нагрузки рекомендуется **PostgreSQL**.

## Быстрый старт (Docker)

```powershell
cd d:\Near
.\scripts\start-postgres.ps1
```

Скрипт поднимает контейнер `near-postgres` и выполняет `alembic upgrade head`.

Затем в `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://near:near@localhost:5432/near
```

Запуск backend как обычно: `.\scripts\start-backend.ps1`

Или вручную:

```bash
docker compose up -d postgres
cd backend
pip install -r requirements.txt   # включает asyncpg
DATABASE_URL=postgresql+asyncpg://near:near@localhost:5432/near alembic upgrade head
```

## Зачем мигрировать

| SQLite | PostgreSQL |
|--------|------------|
| Один писатель, блокировки при нагрузке | Конкурентные записи, пул соединений |
| Файл на диске | Управляемый сервер, бэкапы, репликация |
| Не для нескольких инстансов API | Горизонтальное масштабирование backend |

Для соответствия **242-ФЗ** (локализация ПДн) размещайте managed PostgreSQL **в РФ** (Selectel, Yandex Cloud, VK Cloud и т.п.).

## Настройки пула

В `backend/.env` (только PostgreSQL):

```env
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
```

Реализовано в `app/db/session.py`.

## Схема

Миграции Alembic совместимы с обеими СУБД. UUID и boolean-дефолты адаптированы под PostgreSQL.

```bash
cd backend
alembic upgrade head
```

CI прогоняет тесты на **SQLite** и **PostgreSQL** (см. `.github/workflows/ci.yml`).

## Перенос данных из SQLite

Если уже есть данные в `backend/near.db`:

### Автоматически (Windows)

```powershell
cd d:\Near
.\scripts\migrate-db.ps1
```

Скрипт поднимает PostgreSQL (Docker), показывает dry-run и после подтверждения копирует данные.

### Вручную

```bash
cd backend
pip install -r requirements.txt

# PostgreSQL должен быть запущен (docker compose up -d postgres)

# Проверка без записи
py -m scripts.migrate_sqlite_to_postgres \
  --source ./near.db \
  --target postgresql+asyncpg://near:near@localhost:5432/near \
  --dry-run

# Перенос (схема + данные)
py -m scripts.migrate_sqlite_to_postgres \
  --source ./near.db \
  --target postgresql+asyncpg://near:near@localhost:5432/near \
  --truncate-target
```

Затем в `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://near:near@localhost:5432/near
```

Параметры:

| Флаг | Назначение |
|------|------------|
| `--dry-run` | Только подсчёт строк в SQLite |
| `--skip-alembic` | Не применять миграции на цели |
| `--truncate-target` | Очистить PostgreSQL перед копированием |

Скрипт сверяет количество строк по каждой таблице после переноса.

Для **пустого** деплоя достаточно `alembic upgrade head` без скрипта переноса.

## Production

- `ENV=production` запрещает SQLite (см. `app/core/config.py`)
- Секреты только через env: `DATABASE_URL`, `JWT_SECRET`
- Не публикуйте порт PostgreSQL в интернет; доступ только из private network

## Связанные файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | Сервис `postgres` |
| `scripts/start-postgres.ps1` | Поднять PG + миграции |
| `backend/app/core/config.py` | `DATABASE_URL`, пул |
| `backend/app/db/session.py` | Engine / pool |
| `backend/alembic/env.py` | Async-миграции |
| `backend/scripts/migrate_sqlite_to_postgres.py` | Перенос данных SQLite → PG |

## Оценка трудозатрат (остаток)

| Задача | Статус |
|--------|--------|
| PG в docker-compose + asyncpg | ✅ |
| CI matrix SQLite + PG | ✅ |
| Скрипт миграции данных SQLite→PG | ✅ `scripts/migrate_sqlite_to_postgres.py` |
| Managed PG в РФ + бэкапы | 🔲 инфраструктура |
