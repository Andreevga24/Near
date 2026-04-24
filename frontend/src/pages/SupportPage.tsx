import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

type TicketStatus = 'sent' | 'draft'

type Ticket = {
  id: string
  subject: string
  message: string
  email: string
  createdAt: string
  status: TicketStatus
}

type SupportState = {
  tickets: Ticket[]
  updatedAt: string
}

const NEWS: Array<{ title: string; body: string; at: string }> = [
  {
    title: 'V0.0.3',
    at: '2026-04-24T00:00:00.000Z',
    body: 'Связи задач, режим фокуса, панель задачи (чеклист/комменты/таймлайн), офлайн-очередь (MVP), публичная read-only доска.',
  },
  {
    title: 'V0.0.2',
    at: '2026-04-01T00:00:00.000Z',
    body: 'Сайдбар/шапка, карусель проектов, типы проектов (kind), ноды (React Flow), профиль и улучшения устойчивости UI.',
  },
]

const DEFAULT_STATE: SupportState = {
  tickets: [],
  updatedAt: new Date(0).toISOString(),
}

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function safeParseState(raw: string | null): SupportState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<SupportState> | null
    if (!v || typeof v !== 'object') return null
    return {
      tickets: Array.isArray(v.tickets)
        ? v.tickets
            .filter((t): t is Ticket => !!t && typeof t === 'object')
            .map((t) => ({
              id: typeof t.id === 'string' ? t.id : makeId(),
              subject: typeof t.subject === 'string' ? t.subject : '',
              message: typeof t.message === 'string' ? t.message : '',
              email: typeof t.email === 'string' ? t.email : 'unknown@example.local',
              createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
              status: (t.status === 'sent' || t.status === 'draft' ? t.status : 'sent') as TicketStatus,
            }))
            .filter((t) => t.subject.length > 0 || t.message.length > 0)
        : DEFAULT_STATE.tickets,
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : DEFAULT_STATE.updatedAt,
    }
  } catch {
    return null
  }
}

export function SupportPage() {
  const { user } = useAuth()

  const storageKey = useMemo(() => (user ? `near_support_v1_${user.id}` : null), [user])
  const [state, setState] = useState<SupportState>(DEFAULT_STATE)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storageKey) return
    const loaded = safeParseState(localStorage.getItem(storageKey)) ?? DEFAULT_STATE
    setState(loaded)
    setDirty(false)
    setSavedAt(null)
    setError(null)
  }, [storageKey])

  const save = () => {
    if (!storageKey) return
    const next: SupportState = { ...state, updatedAt: new Date().toISOString() }
    localStorage.setItem(storageKey, JSON.stringify(next))
    setState(next)
    setDirty(false)
    setSavedAt(next.updatedAt)
  }

  const resetLocal = () => {
    if (!storageKey) return
    localStorage.removeItem(storageKey)
    setState(DEFAULT_STATE)
    setDirty(true)
    setSavedAt(null)
    setError(null)
  }

  const createTicket = (status: TicketStatus) => {
    setError(null)
    const s = subject.trim()
    const m = message.trim()
    const email = user?.email ?? 'unknown@example.local'

    if (status === 'sent' && (s.length < 3 || m.length < 10)) {
      setError('Для отправки заполните тему (≥ 3) и сообщение (≥ 10).')
      return
    }
    if (status === 'draft' && s.length === 0 && m.length === 0) {
      setError('Черновик пустой.')
      return
    }

    const nextTicket: Ticket = {
      id: makeId(),
      subject: s || '(без темы)',
      message: m || '(пустое сообщение)',
      email,
      createdAt: new Date().toISOString(),
      status,
    }
    setState((prev) => ({ ...prev, tickets: [nextTicket, ...prev.tickets] }))
    setSubject('')
    setMessage('')
    setDirty(true)
  }

  const deleteTicket = (id: string) => {
    setState((prev) => ({ ...prev, tickets: prev.tickets.filter((t) => t.id !== id) }))
    setDirty(true)
  }

  const sentCount = state.tickets.filter((t) => t.status === 'sent').length
  const draftCount = state.tickets.filter((t) => t.status === 'draft').length

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Поддержка и новости</h1>
          <p className="mt-1 text-sm text-slate-400">
            MVP: FAQ + локальные “тикеты” (без отправки на сервер).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetLocal}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Сбросить локально
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>

      {savedAt ? <p className="mt-2 text-xs text-slate-500">Сохранено: {new Date(savedAt).toLocaleString()}</p> : null}
      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Новости</h2>
          <span className="text-xs text-slate-500">{NEWS.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {NEWS.map((n) => (
            <div key={n.title} className="rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-semibold text-white/85">{n.title}</div>
                <div className="text-xs text-slate-500">{new Date(n.at).toLocaleDateString()}</div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Написать в поддержку</h2>
            <span className="text-xs text-slate-500">автор: {user?.email ?? '—'}</span>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400">Тема</span>
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setDirty(true)
                }}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="Например: Не получается войти"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Сообщение</span>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setDirty(true)
                }}
                rows={6}
                className="mt-1 w-full resize-none rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="Опишите проблему и шаги воспроизведения…"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => createTicket('draft')}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Сохранить как черновик
              </button>
              <button
                type="button"
                onClick={() => createTicket('sent')}
                className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Отправить (локально)
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Сейчас “отправка” — это сохранение в локальный список. Позже подключим реальный backend/почту/интеграции.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Мои обращения</h2>
            <span className="text-xs text-slate-500">
              отправлено: {sentCount} · черновики: {draftCount}
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
            {state.tickets.length === 0 ? (
              <div className="bg-slate-950/30 px-4 py-6 text-center text-sm text-slate-400">
                Пока нет обращений.
              </div>
            ) : (
              state.tickets.slice(0, 30).map((t) => (
                <div key={t.id} className="bg-slate-950/30 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/85">{t.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t.status === 'sent' ? 'Отправлено' : 'Черновик'} · {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTicket(t.id)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                    >
                      Удалить
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{t.message}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

