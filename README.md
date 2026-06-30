# Near

**Текущая версия: V0.0.7**

Near — веб-приложение для управления проектами и задачами: несколько проектов на пользователя, доски в режимах «Канбан» и «Ноды», командная работа, лента и уведомления, workspace (компания, мессенджер, поддержка, отчёты), режим фокуса, архив, публичная доска, офлайн-очередь (MVP), i18n и светлая тема. **V0.0.7** добавляет Phase 2 (тайм-трекинг, Гант, дашборд, экспорт), юридический MVP (152-ФЗ), усиление безопасности, PostgreSQL и production-деплой в Docker.

## Изменения в V0.0.7

### Phase 2 — отчёты и учёт времени

- **Тайм-трекинг**: `POST /time/start`, `POST /time/stop`, `GET /time/active`, `GET /time/report` — панель «Учёт времени» в задаче на доске.
- **Диаграмма Ганта**: `/projects/:projectId/gantt` — полосы по срокам и зависимости blocks.
- **Дашборд отчётов**: burn-down за 14 дней, задачи в работе, просрочки по исполнителям, учёт времени.
- **Экспорт**: `GET /reports/export?format=csv|pdf` — кнопки на странице «Отчёты».

### Юридическое соответствие (152-ФЗ, MVP)

- Страницы **`/legal/privacy`**, **`/legal/terms`**, **`/legal/consent`** — шаблоны документов (требуют правки юриста).
- **Регистрация с согласием**: чекбокс, версии документов, журнал `user_consent_logs` (дата, IP).
- **Права субъекта ПДн**: экспорт JSON (`GET /account/export`) и удаление аккаунта (`DELETE /account`) в настройках профиля.
- **Футер** со ссылками на legal-документы; **предупреждение** перед включением публичной ссылки на доску.
- Чеклист и план: [docs/LEGAL_COMPLIANCE_RU.md](./docs/LEGAL_COMPLIANCE_RU.md).

### Безопасность

- **Production-валидация**: `ENV=production` запрещает дефолтный `JWT_SECRET`, SQLite и пустой `CORS_ORIGINS`.
- **Security headers** и **rate limiting** (login, register, public share, email lookup).
- **CORS** из `CORS_ORIGINS`; Swagger отключён в production.
- **Публичная доска** — схема `PublicTaskRead` без `assignee_id` / `project_id`.
- Редактирование глобальных пресетов — только **superuser**; лимиты на размер workspace, длину сообщений чата, batch email lookup.
- JWT: срок жизни **8 часов**; API по умолчанию **`/api`** (без привязки к `127.0.0.1` в production-сборке).

### База данных и PostgreSQL

- **PostgreSQL** в `docker-compose.yml`; драйвер **asyncpg**; пул соединений (`DB_POOL_SIZE`, `DB_MAX_OVERFLOW`).
- Скрипт переноса **`migrate_sqlite_to_postgres.py`** и `.\scripts\migrate-db.ps1` (SQLite → PostgreSQL).
- Документация: [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md).
- **CI**: pytest на **SQLite** и **PostgreSQL** (включая тест миграции данных).

### Production-деплой

- **`docker-compose.prod.yml`**: nginx (SPA) + FastAPI + PostgreSQL + Redis.
- **Dockerfile** для backend и frontend; **`.env.prod.example`**.
- Reverse proxy `/api` и WebSocket; пример Caddy для TLS.
- Руководство: [docs/DEPLOYMENT_RU.md](./docs/DEPLOYMENT_RU.md); скрипт `.\scripts\deploy-prod.ps1`.

### Инженерное качество

- **GitHub Actions**: pytest (SQLite + PG) + `npm run build`.
- **9 интеграционных тестов** (tasks, archive, focus, share, time, legal, security, migrate).
- Исправлен импорт модели **`TaskTimeEntry`** (тайм-трекинг в тестах).
- Бэклог доработок: [BACKLOG.md](./BACKLOG.md).

## Изменения в V0.0.6

- **Командная работа**: участники проекта, роли owner / editor / viewer, приглашения по email, назначение исполнителя из команды.
- **Лента и уведомления**: серверная лента событий, in-app уведомления, email при @mention, напоминания о дедлайнах.
- **Workspace v2**: тикеты поддержки, мессенджер в БД + WebSocket, отчёты `/reports/summary`, привязка сотрудников к аккаунтам.
- **Доработка MVP**: фокус с весами и exclude blocked, публичная доска v2 (скрытые колонки, срок ссылки), офлайн-индикаторы, стартовые задачи проекта, MiniMap в графе.
- **UX**: i18n (ru/en), светлая тема, глобальный поиск `Ctrl+K`, горячие клавиши `N` / `Esc`, история title/description, мобильная панель задачи.
- **Инженерное качество**: GitHub Actions (pytest + `npm run build`), интеграционные тесты в `backend/tests/`, обновлена документация, план миграции SQLite → PostgreSQL — [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md).

## Изменения в V0.0.5

- **Архив задач**:
  - Закрытие задачи из панели: **«Выполнена»** / **«Не выполнена»** (`POST /tasks/{id}/close`).
  - Страница архива **`/projects/:projectId/archive`**: список закрытых задач, восстановление (`POST /tasks/{id}/restore`).
  - Автоудаление из архива через **`TASK_ARCHIVE_RETENTION_DAYS`** (по умолчанию 30 дней, настраивается в `backend/.env`).
  - WebSocket-события `task_closed` и `task_restored`.

- **Workspace на сервере** (вместо `localStorage`):
  - API **`GET/PUT /workspace/{store_key}`** — ключи: `company`, `messenger`, `support`, `profile`.
  - Хук **`useWorkspaceStore`**: загрузка с сервера, миграция старых данных из `localStorage` при первом входе.
  - Обновлены страницы **Моя компания**, **Мессенджер**, **Поддержка**, **Настройки профиля**.

- **Профиль и компания**:
  - В настройках профиля: **ФИО**, **должность**, **телефон**, поле **«О себе»**.
  - В карточке сотрудника компании: **ФИО** и **должность**.

- **Доска проекта**:
  - После создания задачи автоматически открывается её панель.
  - Кнопка панели переименована в **«Свернуть»** (не путать с закрытием задачи).
  - Ссылки **«Архив задач»** на доске и в панели задачи.

- **Исправления и инфраструктура**:
  - Исправлена ошибка 500 при создании задачи (`add_activity` в таймлайне).
  - Порядок роутов чеклиста (reorder до `/{item_id}`), корректный 404 при удалении несуществующей связи.
  - Режим фокуса: корректные ответы 204 без конфликта OpenAPI.
  - Переход на проект после создания; загрузка состояния публичной ссылки в карусели.
  - Dev API и прокси Vite перенесены на порт **8002** (см. `vite.config.ts`, `scripts/start-backend.ps1`).

- **Документация**:
  - Добавлен **[IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)** — план дальнейших улучшений с чеклистами.

## Изменения в V0.0.4

- **Workspace-разделы стали “живыми” (MVP, локально)**:
  - **Моя компания**: карточка компании + сотрудники/роли (сохранение в `localStorage`).
  - **Мессенджер**: каналы + отправка сообщений (сохранение в `localStorage`).
  - **Лента событий**: сводная лента на основе `created_at/updated_at` проектов и задач + фильтр по проекту.
  - **Отчёты**: сводка по задачам (по статусам, дедлайны/просрочки, ближайшие 7 дней) + фильтр по проекту.
  - **Поддержка и новости**: новости + форма обращения (локальные “тикеты”/черновики в `localStorage`).

- **Навигация**:
  - Убран пункт **«Личные чаты»** из бокового меню.
  - “Чекпоинты/счётчики” в свернутом сайдбаре не показываются в tooltip (видны только при раскрытии панели).

- **Доска проекта**:
  - Бейджи связей задач (← blocks / → blocks / ↔ relates) показываются **только при открытой панели задачи**.

## Изменения в V0.0.3

- **Связи задач (Feature 2)**: `task_links` (blocks/relates), отображение на канбане и в нодах; создание связи в нодах (connect), удаление по клику по ребру.
- **Режим фокуса (Feature 3)**: `GET /focus/next?project_id=...` + страница `/projects/:projectId/focus`.
- **Панель задачи (Feature 4/5)**: комментарии, mentions `@email`, таймлайн активности, чеклист (CRUD + reorder), подсказки колонок и пресеты.
- **Офлайн (Feature 6, MVP)**: app-shell кэш (Service Worker) + очередь мутаций в `localStorage`, синк при `online`, индикатор в сайдбаре.
- **Публичная доска (Feature 7, MVP)**: share-ссылка без логина `/public/:shareId` (read-only), управление ссылкой из UI.

- **Навигация**: левая панель **`AppSidebar`** (тёмно-зелёный стиль), сворачивание ширины, счётчик задач по всем проектам; пункт **«Проекты»** ведёт в **карусель** (`/projects/carousel`), **«+»** — на форму создания (`/projects`). Компактная **`AppHeader`** («На главную») в макете с сайдбаром; **«Выйти»** внизу сайдбара.
- **Проекты**: поле **`kind`** (сценарий доски) при создании; пресеты колонок статусов на backend и frontend. Страница **`/projects/carousel`** — горизонтальная карусель карточек проектов (доска, удаление); **`/projects`** — только форма «Новый проект».
- **Доска задач**: переключатель **«Канбан / Ноды»** (сохранение в `localStorage`); канбан — колонки со списками **`<ul>` / карточки**; ноды — **React Flow** (`@xyflow/react`), перетаскивание между колонками меняет статус. Кнопка **«Дальше →»** в обоих режимах.
- **Профиль** (`/settings`): смена email и пароля через **`PATCH /users/me`** (роутер FastAPI Users с префиксом `/users`).
- **Сессия после входа**: при установке JWT включается состояние загрузки профиля, пока не выполнится **`/me`**, чтобы не было пустого экрана и ложного редиректа на логин.
- **Устойчивость UI**: обработка проектов без **`kind`** в ответе API (fallback в константах). **Vite**: `host: 127.0.0.1`, заголовки **Cache-Control: no-store** в dev (см. `vite.config.ts`).
- **Ранее в этой же версии**: восстановлен модуль **`AppHeader`**; на главной после входа убрана дублирующая кнопка выхода из основного блока.

## История версий

### V0.0.2

- **Навигация**: левая панель **`AppSidebar`** (тёмно-зелёный стиль), сворачивание ширины, счётчик задач по всем проектам; пункт **«Проекты»** ведёт в **карусель** (`/projects/carousel`), **«+»** — на форму создания (`/projects`). Компактная **`AppHeader`** («На главную») в макете с сайдбаром; **«Выйти»** внизу сайдбара.
- **Проекты**: поле **`kind`** (сценарий доски) при создании; пресеты колонок статусов на backend и frontend. Страница **`/projects/carousel`** — горизонтальная карусель карточек проектов (доска, удаление); **`/projects`** — только форма «Новый проект».
- **Доска задач**: переключатель **«Канбан / Ноды»** (сохранение в `localStorage`); канбан — колонки со списками **`<ul>` / карточки**; ноды — **React Flow** (`@xyflow/react`), перетаскивание между колонками меняет статус. Кнопка **«Дальше →»** в обоих режимах.
- **Профиль** (`/settings`): смена email и пароля через **`PATCH /users/me`** (роутер FastAPI Users с префиксом `/users`).
- **Сессия после входа**: при установке JWT включается состояние загрузки профиля, пока не выполнится **`/me`**, чтобы не было пустого экрана и ложного редиректа на логин.
- **Устойчивость UI**: обработка проектов без **`kind`** в ответе API (fallback в константах). **Vite**: `host: 127.0.0.1`, заголовки **Cache-Control: no-store** в dev (см. `vite.config.ts`).
- **Ранее в этой же версии**: восстановлен модуль **`AppHeader`**; на главной после входа убрана дублирующая кнопка выхода из основного блока.

## Возможности (V0.0.7)

### Веб-интерфейс

- **Регистрация и вход** по email и паролю; согласие с политикой и соглашением; сессия на **JWT**.
- **Проекты**: карусель, создание с типом `kind`, участники и роли, публичная ссылка (с предупреждением о конфиденциальности).
- **Доска** (`/projects/:projectId`): канбан и ноды, связи blocks/relates, фильтры (мои / просроченные / без исполнителя).
- **Панель задачи**: чеклист, комментарии, таймлайн, **учёт времени**, архивирование, история полей.
- **Диаграмма Ганта**, **дашборд отчётов**, экспорт **CSV/PDF**.
- **Режим фокуса**, **архив задач**, **публичная read-only доска**.
- **Workspace**: компания, мессенджер, поддержка, лента, отчёты — данные на сервере.
- **Настройки профиля**: экспорт персональных данных, удаление аккаунта.
- **Юридические страницы** `/legal/*`; **уведомления** (колокольчик), **поиск** `Ctrl+K`, **i18n** и **светлая тема**.
- **Офлайн (MVP)**: очередь мутаций и индикатор на карточках.

### Backend, данные и инфраструктура

- **SQLite** (dev) или **PostgreSQL** (prod); Alembic-миграции; скрипт переноса SQLite → PG.
- **REST API** и **Swagger** `/docs` (отключён в `ENV=production`).
- Проверка прав на уровне проекта; rate limiting и security headers.
- **WebSocket** для доски и чата.
- **CI** — pytest на SQLite + PostgreSQL, `npm run build`.
- **Docker Compose prod** — nginx + API + БД: [docs/DEPLOYMENT_RU.md](./docs/DEPLOYMENT_RU.md).

## Идеи «киллер»-уровня (следующие крупные шаги)

См. [BACKLOG.md](./BACKLOG.md) и [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md):

- Billing / оплата, drag-and-drop в канбане, вложения к задачам.
- Web-push, Telegram-бот, полный i18n backend.
- Фоновые задачи (Celery + Redis), observability (Sentry, Prometheus).

### Что пока не входит в V0.0.7

- Drag-n-drop карточек в канбане (перемещение через «Дальше →»).
- Полноценный email-дайджест и push вне браузера.
- Юридически выверенные тексты (шаблоны в продукте — не замена юриста).
- Managed PostgreSQL в РФ и TLS — настраиваются при деплое (см. DEPLOYMENT_RU.md).

## Стек

| Слой | Технологии |
|------|------------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic, SQLite / PostgreSQL |
| Аутентификация | FastAPI Users, JWT |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router |
| Realtime | WebSocket `/ws/{project_id}` |
| Инфраструктура | Docker Compose (dev/prod); CI — GitHub Actions; БД — SQLite или PostgreSQL |

## Структура репозитория

```
Near/
├── .github/workflows/ci.yml   # pytest (SQLite + PG) + npm run build
├── docker-compose.yml         # dev: PostgreSQL + Redis
├── docker-compose.prod.yml    # production: web + backend + PG + Redis
├── .env.prod.example          # шаблон секретов для prod
├── deploy/                    # nginx, Caddy
├── docs/
│   ├── DEPLOYMENT_RU.md       # деплой в production
│   ├── LEGAL_COMPLIANCE_RU.md # 152-ФЗ, чеклист
│   └── POSTGRES_MIGRATION.md
├── BACKLOG.md                 # бэклог после MVP
├── backend/
│   ├── Dockerfile
│   ├── alembic/            # миграции БД
│   ├── tests/              # интеграционные тесты (pytest)
│   ├── app/
│   │   ├── api/            # REST-роутеры
│   │   ├── auth/           # FastAPI Users, JWT
│   │   ├── core/           # настройки
│   │   ├── db/             # async engine / сессия
│   │   ├── models/         # SQLAlchemy-модели
│   │   ├── schemas/        # Pydantic-схемы
│   │   ├── services/       # бизнес-логика
│   │   ├── ws/             # WebSocket
│   │   └── main.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── .env.example
└── frontend/
    ├── Dockerfile
    ├── src/
    └── .env.example
```

## Production

Полный стек в Docker (nginx + FastAPI + PostgreSQL + Redis):

```bash
cp .env.prod.example .env.prod   # заполните секреты
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Подробно: **[docs/DEPLOYMENT_RU.md](./docs/DEPLOYMENT_RU.md)** (TLS, бэкапы, чеклист 152-ФЗ).

PowerShell: `.\scripts\deploy-prod.ps1`

## Требования

- [Docker](https://docs.docker.com/get-docker/) (опционально, для Redis)
- Python **3.11+** и `pip`
- Node.js **20+** и `npm` (для фронтенда)

## Быстрый старт

### 1. Инфраструктура

Из корня репозитория:

```bash
docker compose up -d
```

Поднимется Redis (`6379`) и PostgreSQL (`5432`). По умолчанию приложение использует **SQLite** (`backend/near.db`).

Для PostgreSQL: `.\scripts\start-postgres.ps1`, затем в `backend/.env` задайте `DATABASE_URL=postgresql+asyncpg://near:near@localhost:5432/near` — подробнее в [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md).

### 2. Backend

**Windows (одной командой):** из корня репозитория в PowerShell выполните `.\scripts\start-backend.ps1` (Docker, Python в PATH, интернет для `pip`).

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # или cp на Unix; при необходимости отредактируйте переменные
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8002
```

- API: http://127.0.0.1:8002  
- Swagger: http://127.0.0.1:8002/docs  

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение: http://127.0.0.1:5173. В режиме разработки запросы к API идут на префикс **`/api`** и **проксируются Vite** на `http://127.0.0.1:8002` (без прямого обращения с браузера к другому origin). Файл `frontend/.env` для локальной разработки **не обязателен**.

Убедитесь, что backend запущен на порту **8002**, иначе в консоли браузера будет `Failed to fetch`.

**Если правки в коде «не отображаются» в браузере:** полностью обновите страницу (**Ctrl+Shift+R** / **Ctrl+F5**), либо отключите кэш для этого сайта в инструментах разработчика (Firefox → Сеть → снять «Использовать кэш»). После изменения **`vite.config.ts`** перезапустите `npm run dev`. Смотрите актуальную разработку в **`npm run dev`**, а не в `vite preview` без свежего **`npm run build`**. Убедитесь, что открыт именно **http://127.0.0.1:5173/** (см. `host` в `vite.config.ts`).

### Переменные окружения

**Backend** (`backend/.env`, см. `backend/.env.example`):

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | SQLite: `sqlite+aiosqlite:///./near.db` (по умолчанию) или PostgreSQL: `postgresql+asyncpg://user:pass@host:5432/near` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | Пул соединений PostgreSQL (по умолчанию 5 / 10) |
| `JWT_SECRET` | Секрет подписи JWT (в продакшене — `openssl rand -hex 32`) |
| `ENV` | `development` или `production` (в prod — строгая валидация секретов и БД) |
| `CORS_ORIGINS` | Домены фронтенда через запятую (обязательно в production) |
| `TRUSTED_HOSTS` | Доверенные Host-заголовки за reverse proxy |
| `RATE_LIMIT_ENABLED` | Rate limiting (`true` / `false`) |
| `LEGAL_OPERATOR_NAME` / `LEGAL_CONTACT_EMAIL` | Реквизиты оператора ПДн |
| `JWT_LIFETIME_SECONDS` | Время жизни access token (секунды) |
| `TASK_ARCHIVE_RETENTION_DAYS` | Срок хранения закрытых задач в архиве (дней), по умолчанию `30` |

**Frontend** (`frontend/.env`, опционально):

| Переменная | Описание |
|------------|----------|
| `VITE_API_BASE_URL` | По умолчанию **`/api`** (тот же origin; в dev — прокси Vite → `127.0.0.1:8002`). Задайте полный URL, если API на другом хосте. |

## Ошибка «Bad Gateway» во фронтенде (dev)

В режиме `npm run dev` запросы идут на **`/api`**, а Vite **проксирует** их на **`http://127.0.0.1:8002`**. Код **502 Bad Gateway** значит: до FastAPI достучаться не удалось (часто **uvicorn не запущен** или порт не 8002).

Проверьте в браузере http://127.0.0.1:8002/docs — страница должна открываться. Затем снова войдите с http://127.0.0.1:5173.

## API (кратко)

| Метод | Путь | Описание |
|--------|------|----------|
| POST | `/register` | Регистрация с согласием (email, password, accept_privacy, accept_terms, версии документов) |
| GET | `/legal/meta` | Версии юридических документов и реквизиты оператора |
| GET | `/account/export` | Экспорт данных пользователя (JSON) |
| DELETE | `/account` | Удаление аккаунта (пароль + подтверждение `DELETE`) |
| POST | `/login` | Вход (form: `username`=email, `password`) → `access_token` |
| GET | `/me` | Текущий пользователь (заголовок `Authorization: Bearer …`) |
| PATCH | `/users/me` | Обновление своего профиля (email, пароль и др. поля схемы `UserUpdate`) |
| GET/POST/PUT/DELETE | `/projects` | CRUD своих проектов; при создании тело включает **`kind`** (тип сценария доски) |
| GET/POST/PUT/DELETE | `/tasks` | CRUD задач в своих проектах; список: `GET /tasks?project_id=…` (только активные); при создании без **`status`** подставляется первый статус пресета проекта |
| POST | `/tasks/{id}/close` | Закрыть задачу (тело: `{ "completed": true/false }`) → архив |
| POST | `/tasks/{id}/restore` | Восстановить задачу из архива на доску |
| GET | `/tasks/archived` | Список архивных задач (`project_id` query) + `retention_days` |
| GET | `/search` | Глобальный поиск по проектам и задачам |
| GET/POST | `/projects/{id}/members` | Участники проекта, приглашения |
| GET | `/feed` | Лента событий |
| GET/PATCH | `/notifications` | In-app уведомления |
| GET | `/reports/summary` | Сводка по задачам (активные, архив, velocity) |
| GET | `/reports/dashboard` | Дашборд: burn-down, в работе, просрочки по исполнителям |
| GET | `/reports/export?format=csv\|pdf` | Экспорт отчёта (CSV для Excel, PDF) |
| POST | `/time/start`, `/time/stop` | Тайм-трекинг по задаче |
| GET | `/time/report` | Отчёт по учтённому времени |
| GET | `/projects/{id}/gantt` | Данные для диаграммы Ганта |
| GET/POST | `/support/tickets` | Тикеты поддержки |
| GET/POST | `/messenger/channels` | Каналы мессенджера |
| GET/PUT | `/workspace/{store_key}` | Данные workspace (`company`, `messenger`, `support`, `profile`) |
| GET/POST/PUT/DELETE | `/task-links` | Связи задач (blocks/relates) в проекте |
| GET | `/focus/next` | Следующая задача для режима фокуса (`project_id` query) |
| GET/POST/DELETE | `/comments` | Комментарии к задаче |
| GET | `/timeline` | Таймлайн по задаче (активности + комментарии) |
| GET/POST/PUT/DELETE | `/checklist-items` | Пункты чеклиста задачи (+ reorder) |
| GET/PUT | `/presets/{kind}` | Пресеты сценариев (подсказки колонок/шаблоны чеклистов) |
| GET/PUT | `/projects/{id}/share/*` | Включение/выключение публичной ссылки (owner) |
| GET | `/public/{share_id}` | Публичная read-only доска без логина |
| WS | `/ws/{project_id}?token=…` | Подписка на события канбана по проекту (тот же JWT) |

Подробности схем запросов и ответов — в **OpenAPI** (`/docs`).

## WebSocket

Подключение: `ws://127.0.0.1:8002/ws/<project_id>?token=<access_token>`.  
После изменений задач через REST клиентам рассылаются JSON-сообщения (например, `task_created`, `task_updated`, `task_deleted`, `task_closed`, `task_restored`); при удалении проекта — `project_deleted` и закрытие соединений.

## Сборка фронтенда

```bash
cd frontend
npm run build
```

Артефакты появятся в `frontend/dist/`.

## Тесты и CI

**Backend** (из каталога `backend`):

```bash
pip install -r requirements-dev.txt
pytest
```

**Frontend**:

```bash
cd frontend
npm run build
```

На pull request и push в `main` workflow [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) запускает pytest на **SQLite** и **PostgreSQL**, затем `npm run build`.

## Лицензия и вклад

Репозиторий проекта Near — внутренняя разработка; при добавлении лицензии или гайдлайнов для контрибьюторов обновите этот раздел.
