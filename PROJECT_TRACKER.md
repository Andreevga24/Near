# Near — Project Tracker

## Статус: Phase 1 / In Development

---

## Общее описание

Near — веб-приложение для управления проектами (аналог Yougile / Projecto / Weeek).

Аудитория: русскоязычная. Интерфейс: **русский + английский** (переключатель в настройках).

Подробный план фич: [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md).  
План улучшений после MVP: [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md).

---

## Технологический стек (актуальный)

| Компонент | Технология |
|-----------|-------------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic |
| БД | SQLite (файл `backend/near.db`); план PG — [docs/POSTGRES_MIGRATION.md](./docs/POSTGRES_MIGRATION.md) |
| Auth | FastAPI Users, JWT |
| Realtime | WebSocket `/ws/{project_id}`, `/ws/chat/{channel_id}` |
| Инфра | Docker Compose: Redis 7 (опционально); CI — GitHub Actions |

---

## Phase 1 — MVP (основное)

### Модуль 1: Проекты

- [x] Создание проекта (название, описание, тип `kind`)
- [x] Список проектов (карусель)
- [x] Редактирование / удаление проекта
- [x] Приглашение участников по email, роли owner / editor / viewer
- [x] Публичная read-only доска по ссылке

### Модуль 2: Задачи

- [x] Создание задачи (название, исполнитель, дедлайн, приоритет)
- [x] Доска задач (канбан + режим «Ноды»)
- [x] Перемещение статуса («Дальше →»); связи blocks / relates
- [x] Комментарии, @упоминания, таймлайн активности
- [x] Чеклист, дублирование / копирование между проектами
- [x] Архив: закрытие, восстановление, retention
- [x] Режим фокуса (`/focus/next`)

### Модуль 3: Пользователи

- [x] Регистрация / вход (email + пароль)
- [x] Профиль (ФИО, должность, телефон, смена email/пароля)
- [x] Роли в проекте: владелец / редактор / наблюдатель
- [x] Уведомления in-app + email @mention (MVP)

### Модуль 4: Workspace

- [x] Моя компания (сотрудники, привязка к аккаунтам)
- [x] Мессенджер (каналы, сообщения, WS)
- [x] Поддержка (тикеты)
- [x] Лента событий и отчёты на сервере
- [x] Данные workspace в БД (`/workspace/{key}`)

### Модуль 5: Интерфейс

- [x] i18n (ru / en)
- [x] Светлая / тёмная тема
- [x] Адаптив доски и панели задачи
- [x] Глобальный поиск (Ctrl+K)
- [x] Горячие клавиши N / Esc на доске

### Модуль 6: Инженерное качество

- [x] GitHub Actions: pytest + `npm run build`
- [x] Интеграционные тесты API (tasks, archive, focus, share)
- [ ] Полный CI matrix SQLite + PostgreSQL

---

## Phase 2 — расширение

См. блок 16 в [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md):

- [x] Тайм-трекинг задач (MVP)
- [x] Гант-диаграмма (MVP)
- [x] Экспорт отчётов (CSV/PDF)
- [x] Дашборд с метриками (MVP)

---

## Текущие баги

- Нет известных критичных (см. issues / CI)

---

## Технические заметки

- Граф задач: `@xyflow/react`
- Офлайн: Service Worker + очередь мутаций
- Тесты: `backend/tests/`, `pytest` из каталога `backend`
- Скрипты ручной проверки: `backend/scripts/test_feature*.py`

---

## Журнал (кратко)

| Дата | Задача |
|------|--------|
| 2026-06-26 | Блоки 8–14 IMPROVEMENT_ROADMAP: архив, команда, лента, workspace v2, UX |
| 2026-06-26 | Блок 15: CI, интеграционные тесты, синхронизация документации |
