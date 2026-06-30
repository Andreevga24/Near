# Near — бэклог доработок

Документ составлен по анализу проекта **V0.0.7** (2026-06-26).  
Roadmap-блоки **8–16** в [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md) закрыты на уровне **MVP**; ниже — что остаётся доделать до полноценного продукта и продакшена.

**Легенда приоритетов:** 🔴 высокий · 🟡 средний · 🟢 низкий / по необходимости

---

## Сводка

| Область | Статус MVP | Главный gap |
|---------|------------|-------------|
| Доска / задачи | ✅ | Kanban без drag-and-drop |
| Команда / роли | ✅ | «Компания» — JSON на пользователя, не org |
| Уведомления | MVP | Нет фоновых jobs, push, Telegram |
| Workspace | MVP | Billing — заглушка; support без админки |
| Phase 2 (Гант, time, отчёты) | MVP | Упрощённые версии, нет .xlsx |
| i18n | MVP | ~36 ключей; большинство страниц только RU |
| Инженерия | MVP | SQLite, 5 тестов, нет деплоя |

---

## 1. Продукт: явные дыры

| # | Задача | Приоритет | Примечание |
|---|--------|-----------|------------|
| 1.1 | **Billing / «Лицензия и оплаты»** | 🔴 | Пункт в сайдбаре → `WorkspacePlaceholderPage`; нет API и платёжного провайдера. Реализовать или убрать из меню. |
| 1.2 | **Drag-and-drop в канбане** | 🟡 | Статус только через «Дальше →»; в режиме нод перетаскивание есть. |
| 1.3 | **Вложения к задачам** | 🟢 | Файлы, превью, лимиты, антивирус — не начато. |
| 1.4 | **Автоматизации** | 🟢 | Правила «если X → Y» (статус, назначение, уведомление). |
| 1.5 | **Telegram-бот** | 🟢 | Единственный явно незакрытый пункт в IMPROVEMENT_ROADMAP блок 11. |
| 1.6 | **Web Push** | 🟢 | In-app + email @mention есть; push вне вкладки — нет. |
| 1.7 | **Мобильные клиенты** | 🟢 | Только адаптивный веб. |

---

## 2. MVP → полная версия

### 2.1 Уведомления

| Задача | Файлы / контекст |
|--------|------------------|
| Email только при настроенном SMTP; иначе — лог | `backend/app/services/notifications.py`, `backend/.env.example` |
| Напоминания о дедлайнах — при открытии `/notifications`, нет cron/Celery | `ensure_due_reminders` в notifications.py |
| Тексты уведомлений на backend — только русский | `ACTIVITY_LABELS`, заголовки в notifications.py |
| Колокольчик опрашивает API раз в 60 с, нет WS-push | `frontend/src/components/NotificationBell.tsx` |
| Telegram-бот | см. п. 1.5 |

### 2.2 Офлайн-очередь

| Задача | Файлы / контекст |
|--------|------------------|
| Service Worker отключён в dev | `frontend/src/registerServiceWorker.ts` |
| Очередь в `localStorage`, нет серверного merge конфликтов | `frontend/src/api/offlineQueue.ts`, `client.ts` |
| При ошибке синка — слабая обратная связь пользователю | `client.ts` (mutations → `undefined`) |
| SW кэширует только app-shell, не API | `frontend/public/sw.js` |

### 2.3 Мессенджер

| Задача | Файлы / контекст |
|--------|------------------|
| Каналы в БД + WebSocket — есть | `backend/app/api/messenger.py`, `MessengerPage.tsx` |
| Нет личных чатов, @mentions, поиска, read receipts | UI/API gaps |
| Каналы по задаче: API `task_id` есть, в UI только `project_id` | messenger API vs MessengerPage |
| Авто-создание `#general` при пустом списке | MessengerPage |

### 2.4 Поддержка

| Задача | Файлы / контекст |
|--------|------------------|
| Тикеты пользователя в БД | `backend/app/api/support.py`, `SupportPage.tsx` |
| Нет админ-панели оператора, SLA, эскалации | support.py — фильтр `user_id == current` |
| Новости — захардкоженный массив, не CMS | `SupportPage.tsx` (`NEWS`) |
| Нет email при ответе на тикет | — |

### 2.5 «Моя компания»

| Задача | Файлы / контекст |
|--------|------------------|
| Данные в `user_workspace_stores` (JSON), не общая организация | `CompanyPage.tsx`, `/workspace/company` |
| Привязка email → user через `resolveEmails` — есть, но не multi-tenant | `CompanyPage.tsx`, `user_lookup` API |
| Устаревшие ключи `messenger` / `support` в схеме workspace | `backend/app/schemas/workspace.py` |

### 2.6 Phase 2 (блок 16)

| Задача | Статус MVP | Что доработать |
|--------|------------|----------------|
| Тайм-трекинг | ✅ базово | Ручной ввод, паузы, отображение в ReportsPage |
| Гantt | ✅ базово | Drag по срокам, стрелки blocks, масштаб времени |
| Экспорт | CSV + PDF | Настоящий `.xlsx` (openpyxl); богаче PDF |
| Дашборд / burn-down | ✅ базово | Классический burndown, фильтры, drill-down |

### 2.7 i18n

| Задача | Детали |
|--------|--------|
| ~36 ключей в `messages.ts` | nav, search, часть board/settings |
| 15+ страниц без `t()` | Login, Home, Projects, Messenger, Feed, Reports, Support, Gantt, Archive, Focus, … |
| Backend / PDF / ошибки API — русский | notifications.py, reports export, auth.ts, client.ts |

---

## 3. Инженерия и продакшен

### 3.1 Инфраструктура

| # | Задача | Приоритет | Детали |
|---|--------|-----------|--------|
| 3.1 | **PostgreSQL** | 🔴 | План: [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md); сейчас SQLite по умолчанию |
| 3.2 | **CI matrix SQLite + PostgreSQL** | 🟡 | Отмечено в PROJECT_TRACKER как не сделано |
| 3.3 | **Dockerfile backend + frontend** | 🔴 | Нет образов; только `docker-compose` с Redis |
| 3.4 | **Prod CORS** | 🔴 | `main.py` — только localhost / 127.0.0.1 |
| 3.5 | **Секреты** | 🔴 | `JWT_SECRET` с dev-дефолтом в `config.py` |
| 3.6 | **Redis / Celery** | 🟡 | Redis в compose не используется кодом; нужен для фоновых задач |
| 3.7 | **Rate limiting, observability** | 🟡 | Sentry, Prometheus, structured logging — нет |
| 3.8 | **Верификация email** | 🟡 | Регистрация без подтверждения почты |

### 3.2 Фоновые задачи (нет cron/Celery)

| Задача | Сейчас |
|--------|--------|
| Purge архива по `TASK_ARCHIVE_RETENTION_DAYS` | При запросах списка задач (`purge_expired_archived_tasks`) |
| Email @mention и due-reminders | Только при HTTP-запросах пользователя |
| Дайджест уведомлений | Нет |

Рекомендация: Celery + Redis или APScheduler; см. комментарии в `auth/manager.py`, `docker-compose.yml`.

### 3.3 Тестирование

| Область | Покрытие |
|---------|----------|
| **Backend pytest** | 5 тестов: tasks CRUD, archive, focus, share, time (`backend/tests/`) |
| **Не покрыто** | members/invites, feed, notifications, messenger, support, reports/export, gantt, search, WebSocket, workspace |
| **Frontend** | Нет unit/e2e тестов; `package.json` без `test` |
| **CI** | pytest + `npm run build`; **eslint не в CI** |
| **Ручные скрипты** | `backend/scripts/test_feature2_links.py`, `test_feature4_comments.py` — не в CI |

---

## 4. UX и полировка

| # | Задача | Где |
|---|--------|-----|
| 4.1 | Удалить/сузить `WorkspacePlaceholderPage` (устаревший текст V0.0.2) | `frontend/src/pages/WorkspacePlaceholderPage.tsx` |
| 4.2 | Убрать фейковый бейдж «+2» у Поддержки | `frontend/src/components/AppSidebar.tsx` |
| 4.3 | WebSocket: patch задач по телу события вместо полного reload | `ProjectBoardPage.tsx`, WS hub |
| 4.4 | Расширить горячие клавиши | Сейчас N / Esc на доске |
| 4.5 | Полнотекстовый поиск, сохранённые фильтры | `/search` — базовый |
| 4.6 | Светлая тема — выверить все workspace-страницы | index.css, страницы reports/support/… |

---

## 5. Документация и согласованность

| # | Несоответствие | Действие |
|---|----------------|----------|
| 5.1 | README **V0.0.7**, раздел «Возможности» — **V0.0.6** | Обновить README |
| 5.2 | FEATURE_ROADMAP: фичи 5–6 «в процессе», чеклисты [x] | Синхронизировать статусы |
| 5.3 | PROJECT_TRACKER «Phase 1 In Development» vs roadmap «Готово MVP» | Обновить статус фазы |
| 5.4 | OpenAPI `version="0.1.0"` vs продукт V0.0.7 | `backend/app/main.py` |
| 5.5 | Roadmap: «Excel», реализация: CSV | Документ или код |
| 5.6 | SupportPage NEWS ссылается на V0.0.5 | Обновить контент |
| 5.7 | Локально: `alembic upgrade head` для миграции **0016** (time entries) | Инструкция в README / onboarding |

---

## 6. Рекомендуемый порядок работ

### Быстрые wins (1–3 дня)

- [ ] Скрыть или реализовать минимально billing
- [ ] Почистить `WorkspacePlaceholderPage`, убрать «+2» в сайдбаре
- [ ] Синхронизировать README, FEATURE_ROADMAP, PROJECT_TRACKER, версии
- [ ] Добавить `eslint` в GitHub Actions
- [ ] Расширить pytest: members, notifications, reports/export

### Перед первым деплоем (1–2 недели)

- [ ] PostgreSQL + CI matrix
- [ ] Dockerfile, prod CORS, секреты через env
- [ ] Фоновые задачи: purge архива, due-reminders, email (Celery/APScheduler + Redis)
- [ ] Документировать SMTP в `.env.example`

### Продуктовый рост (по необходимости)

- [ ] Полный i18n (все страницы + backend messages)
- [ ] Kanban drag-and-drop
- [ ] Вложения, автоматизации
- [ ] Админка поддержки, Telegram, web-push
- [ ] Billing / монетизация

---

## Связанные файлы

| Документ | Назначение |
|----------|------------|
| [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md) | Закрытые блоки 8–16 (MVP) |
| [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md) | «Киллер»-фичи 1–8 |
| [PROJECT_TRACKER.md](./PROJECT_TRACKER.md) | Трекер модулей Phase 1/2 |
| [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md) | План миграции БД |
| [docs/LEGAL_COMPLIANCE_RU.md](./docs/LEGAL_COMPLIANCE_RU.md) | Соответствие законодательству РФ (152-ФЗ и др.) |
| [README.md](./README.md) | Быстрый старт, API, версии |

---

## Журнал

| Дата | Изменение |
|------|-----------|
| 2026-06-26 | Создан BACKLOG.md по полному анализу кодовой базы V0.0.7 |
