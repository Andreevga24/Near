/**
 * Главная: состояние авторизации и ссылки на формы.
 */

import { Link } from 'react-router-dom'

import { AppFooter } from '../components/AppFooter'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'

export function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-slate-400">
        Загрузка…
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <main className="near-app-bg">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-950/40 px-3 py-1 text-xs text-slate-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                Вы вошли как <span className="font-mono text-slate-100">{user.email}</span>
              </div>

              <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Постройте процесс работы команды — от идеи до релиза.
              </h1>
              <p className="mt-5 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
                Near объединяет проекты, доски задач, связи, фокус-режим и ленту событий — чтобы вы
                держали контроль без лишнего шума.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/projects/carousel"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-400 sm:w-auto"
                >
                  Открыть проекты
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40 sm:w-auto"
                >
                  Профиль и безопасность
                </Link>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Ваш id: <span className="font-mono">{user.id}</span>
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="near-card">
                <p className="text-sm font-medium text-white">Канбан и “ноды”</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Выбирайте визуализацию: классические колонки или граф связей в React Flow.
                </p>
              </div>
              <div className="near-card">
                <p className="text-sm font-medium text-white">Связи задач</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Blocks/relates, быстрые подсказки и контекст в панели задачи.
                </p>
              </div>
              <div className="near-card">
                <p className="text-sm font-medium text-white">Офлайн-очередь</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Мутации не теряются: очередь в браузере синхронизируется при возвращении в сеть.
                </p>
              </div>
              <div className="near-card">
                <p className="text-sm font-medium text-white">Публичные ссылки</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Делитесь read-only доской без логина — удобно для клиентов и стейкхолдеров.
                </p>
              </div>
              <div className="near-card">
                <p className="text-sm font-medium text-white">Лента событий</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Быстро понимаете, что изменилось: проекты и задачи попадают в общий фид.
                </p>
              </div>
              <div className="near-card">
                <p className="text-sm font-medium text-white">Режим фокуса</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Берёт “следующую” задачу по правилам — чтобы не тратить время на выбор.
                </p>
              </div>
            </div>

            <section className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="near-card">
                <p className="text-sm font-medium text-white">Быстрый старт</p>
                <ol className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900/60 text-[11px] text-slate-200">
                      1
                    </span>
                    Создайте проект и выберите тип (колонки и подсказки).
                  </li>
                  <li>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900/60 text-[11px] text-slate-200">
                      2
                    </span>
                    Добавляйте задачи, связи и чеклисты.
                  </li>
                  <li>
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900/60 text-[11px] text-slate-200">
                      3
                    </span>
                    Включите публичную ссылку или работайте командой по логину.
                  </li>
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/projects" className="near-btn-primary">
                    Создать проект
                  </Link>
                  <Link to="/workspace/feed" className="near-btn-secondary">
                    Открыть ленту
                  </Link>
                </div>
              </div>

              <div className="near-card">
                <p className="text-sm font-medium text-white">Что есть уже сейчас</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Realtime</p>
                    <p className="mt-1 text-sm text-slate-200">WebSocket-обновления на доске</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Task panel</p>
                    <p className="mt-1 text-sm text-slate-200">Чеклист, комменты, таймлайн</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Links</p>
                    <p className="mt-1 text-sm text-slate-200">Blocks/relates + визуализация</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Offline</p>
                    <p className="mt-1 text-sm text-slate-200">Очередь мутаций в браузере</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Хотите больше? Загляните в разделы Workspace — там уже есть MVP-страницы (локально).
                </p>
              </div>
            </section>
          </div>
        </main>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="near-app-bg min-h-svh">
      <header>
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-24 lg:px-8">
          <nav className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800/70 bg-slate-950/40 text-sm font-semibold text-white backdrop-blur">
                N
              </span>
              <span className="text-sm font-semibold tracking-wide text-slate-100">Near</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900/40"
              >
                Вход
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                Регистрация
              </Link>
            </div>
          </nav>

          <div className="mx-auto mt-14 max-w-3xl text-center sm:mt-20">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Управляйте проектами. Держите фокус. Двигайтесь быстрее.
            </h1>
            <p className="mt-5 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
              Near — это доски задач, связи, публичные read-only ссылки, лента событий и офлайн-режим
              в одном приложении.
            </p>

            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                Начать бесплатно
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-slate-900/40"
              >
                У меня уже есть аккаунт
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                WebSocket-обновления
              </span>
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                Канбан / Ноды
              </span>
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                Public read-only
              </span>
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                Offline queue (MVP)
              </span>
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                Чеклисты и комменты
              </span>
              <span className="rounded-full border border-slate-800/70 bg-slate-950/30 px-3 py-1">
                Режим фокуса
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Доски под разные процессы</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Тип проекта задаёт статусы и подсказки — быстро стартуете без ручной настройки.
            </p>
          </div>
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Панель задачи</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Чеклист, комментарии, таймлайн активности — всё рядом с доской.
            </p>
          </div>
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Режим фокуса</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Одна следующая задача по правилам — меньше переключений, больше результата.
            </p>
          </div>
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Связи задач</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Blocks/relates, наглядно на “нодах” и в панели задачи.
            </p>
          </div>
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Публичная доска</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Read-only ссылка для просмотра прогресса без доступа к аккаунту.
            </p>
          </div>
          <div className="near-card p-6">
            <p className="text-sm font-medium text-white">Офлайн (MVP)</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Очередь операций в браузере — синхронизируется при возвращении в сеть.
            </p>
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="near-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Как это работает</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Понятная структура, быстрые действия</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                <span className="near-badge mr-2">1</span>
                Создаёте проект и выбираете тип — колонки будут готовы сразу.
              </li>
              <li>
                <span className="near-badge mr-2">2</span>
                Добавляете задачи и двигаете их по статусам (или на графе).
              </li>
              <li>
                <span className="near-badge mr-2">3</span>
                Открываете панель задачи: чеклист, комментарии, таймлайн.
              </li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/register" className="near-btn-primary">
                Создать аккаунт
              </Link>
              <Link to="/login" className="near-btn-secondary">
                Войти
              </Link>
            </div>
          </div>

          <div className="near-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Превью</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Доска, которая “дышит”</h2>
            <p className="mt-2 text-sm text-slate-300">
              Ниже — декоративный макет, чтобы показать настроение интерфейса без скриншотов.
            </p>
            <div className="mt-4 rounded-xl border border-slate-800/60 bg-slate-950/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-40 rounded bg-slate-800/70" />
                <div className="flex gap-2">
                  <div className="h-7 w-20 rounded-lg bg-emerald-500/80" />
                  <div className="h-7 w-20 rounded-lg border border-slate-800/70" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <div className="h-2.5 w-16 rounded bg-slate-800/70" />
                  <div className="h-8 rounded bg-slate-900/60" />
                  <div className="h-8 rounded bg-slate-900/60" />
                </div>
                <div className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <div className="h-2.5 w-20 rounded bg-slate-800/70" />
                  <div className="h-8 rounded bg-slate-900/60" />
                  <div className="h-8 rounded bg-slate-900/60" />
                </div>
                <div className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                  <div className="h-2.5 w-14 rounded bg-slate-800/70" />
                  <div className="h-8 rounded bg-slate-900/60" />
                  <div className="h-8 rounded bg-slate-900/60" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 near-card p-6">
          <h2 className="text-lg font-semibold text-white">FAQ</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-slate-100">Это бесплатно?</p>
              <p className="mt-1 text-sm text-slate-300">
                Сейчас это внутренняя разработка (MVP). Регистрация и функциональность доступны локально.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Можно делиться проектом без доступа?</p>
              <p className="mt-1 text-sm text-slate-300">
                Да — через публичную read-only ссылку, которую включает владелец проекта.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Есть ли realtime?</p>
              <p className="mt-1 text-sm text-slate-300">
                На доске работает WebSocket: изменения задач разлетаются по вкладкам/клиентам.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Что с офлайном?</p>
              <p className="mt-1 text-sm text-slate-300">
                В браузере есть MVP-очередь мутаций: при восстановлении сети выполнит накопленные действия.
              </p>
            </div>
          </div>
        </section>

      </main>

      <AppFooter />
    </div>
  )
}
