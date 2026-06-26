# План миграции SQLite → PostgreSQL

Near сейчас использует **SQLite** (`sqlite+aiosqlite`) для локальной разработки и MVP. Перед продакшеном с несколькими инстансами backend рекомендуется **PostgreSQL**.

## Зачем мигрировать

| SQLite | PostgreSQL |
|--------|------------|
| Один писатель, блокировки при нагрузке | Конкурентные записи, пул соединений |
| Файл на диске | Управляемый сервер, бэкапы, репликация |
| Ограниченные типы и JSON | Полноценный JSONB, полнотекстовый поиск |

Код уже рассчитан на async SQLAlchemy; в `alembic/env.py` есть ветка для `postgresql+asyncpg`.

## Этапы

### 1. Подготовка окружения

1. Поднять PostgreSQL (Docker, managed DB или локально).
2. Добавить в `backend/requirements.txt` (когда понадобится прод):
   ```
   asyncpg>=0.30.0,<1.0.0
   ```
3. Задать в `backend/.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/near
   ```

### 2. Схема

```bash
cd backend
alembic upgrade head
```

Миграции Alembic должны применяться на чистой PG-базе так же, как на SQLite. Перед продом прогнать CI и ручной smoke на PostgreSQL.

### 3. Перенос данных (если есть prod-данные в SQLite)

1. Экспорт из SQLite (один раз):
   - `sqlite3 near.db .dump` или скрипт на SQLAlchemy, читающий все таблицы.
2. Адаптация типов:
   - UUID — уже `CHAR(36)` / native UUID в моделях.
   - `BOOLEAN`, `DATETIME` — проверить совместимость в дампе.
3. Импорт в PostgreSQL через `psql` или Python-скрипт построчной вставки с сохранением порядка FK (users → projects → tasks → …).
4. Сверка счётчиков строк по основным таблицам.

Для **пустого** деплоя достаточно только `alembic upgrade head`.

### 4. Настройки приложения

- Убрать `NullPool` для SQLite в `app/db/session.py` — для PostgreSQL уже используется `pool_pre_ping`.
- Задать разумный `pool_size` / `max_overflow` при высокой нагрузке.
- `JWT_SECRET`, SMTP и прочие секреты — только через переменные окружения, не в репозитории.

### 5. Проверка перед cutover

- [ ] `pytest` на CI с `DATABASE_URL=postgresql+asyncpg://...` (отдельный job или matrix).
- [ ] Регистрация, проекты, задачи, архив, WebSocket, публичная доска.
- [ ] Нагрузочный smoke: несколько параллельных клиентов на одном проекте.

### 6. Откат

Держать snapshot SQLite до стабилизации PG. При откате — вернуть `DATABASE_URL` на SQLite и старый файл БД (данные, созданные только в PG, не перенесутся автоматически).

## Оценка трудозатрат

| Задача | Оценка |
|--------|--------|
| PG в docker-compose + `.env.example` | 0.5 дня |
| CI matrix (SQLite + PG) | 0.5 дня |
| Скрипт миграции данных | 1–2 дня (если нужен перенос) |
| Smoke + документация деплоя | 0.5 дня |

## Связанные файлы

- `backend/app/core/config.py` — `DATABASE_URL`
- `backend/app/db/session.py` — engine / pool
- `backend/alembic/env.py` — async migrations
- `docker-compose.yml` — сейчас только Redis; PG можно добавить как опциональный сервис
