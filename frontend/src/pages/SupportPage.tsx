import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import {
  addSupportReply,
  createSupportTicket,
  deleteSupportTicket,
  getSupportTicket,
  listSupportTickets,
  type SupportTicket,
  type SupportTicketDetail,
  type SupportTicketStatus,
} from '../api/support'
import { useAuth } from '../context/AuthContext'

const NEWS: Array<{ title: string; body: string; at: string }> = [
  {
    title: 'V0.0.5',
    at: '2026-06-26T00:00:00.000Z',
    body: 'Тикеты поддержки в БД, мессенджер с WebSocket, отчёты с архивом и velocity.',
  },
  {
    title: 'V0.0.4',
    at: '2026-06-01T00:00:00.000Z',
    body: 'Workspace-разделы (компания, мессенджер, поддержка) сохраняются на сервере.',
  },
]

function statusLabel(status: SupportTicketStatus): string {
  switch (status) {
    case 'draft':
      return 'Черновик'
    case 'open':
      return 'Открыт'
    case 'in_progress':
      return 'В работе'
    case 'resolved':
      return 'Решён'
    case 'closed':
      return 'Закрыт'
  }
}

export function SupportPage() {
  const { user, token, logout } = useAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadTickets = useCallback(async () => {
    if (!token) return
    const list = await listSupportTickets(token)
    setTickets(list)
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    void loadTickets()
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить обращения')
      })
      .finally(() => setLoading(false))
  }, [token, loadTickets, logout])

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null)
      return
    }
    void getSupportTicket(token, selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [token, selectedId])

  const createTicket = async (status: 'draft' | 'open') => {
    if (!token) return
    setError(null)
    const s = subject.trim()
    const m = message.trim()
    if (status === 'open' && (s.length < 3 || m.length < 10)) {
      setError('Для отправки заполните тему (≥ 3) и сообщение (≥ 10).')
      return
    }
    if (status === 'draft' && s.length === 0 && m.length === 0) {
      setError('Черновик пустой.')
      return
    }
    setSubmitting(true)
    try {
      const t = await createSupportTicket(token, {
        subject: s || '(без темы)',
        body: m || '(пустое сообщение)',
        status,
      })
      setTickets((prev) => [t, ...prev])
      setSubject('')
      setMessage('')
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось создать обращение')
    } finally {
      setSubmitting(false)
    }
  }

  const removeTicket = async (id: string) => {
    if (!token) return
    try {
      await deleteSupportTicket(token, id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось удалить')
    }
  }

  const sendReply = async () => {
    if (!token || !selectedId) return
    const body = replyText.trim()
    if (!body) return
    setSubmitting(true)
    try {
      await addSupportReply(token, selectedId, body)
      const d = await getSupportTicket(token, selectedId)
      setDetail(d)
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedId ? { ...t, status: d.status, reply_count: d.replies.length } : t,
        ),
      )
      setReplyText('')
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось отправить ответ')
    } finally {
      setSubmitting(false)
    }
  }

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const draftCount = tickets.filter((t) => t.status === 'draft').length

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
  }

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-white">Поддержка и новости</h1>
        <p className="mt-1 text-sm text-slate-400">Обращения хранятся в базе данных с ответами и статусами.</p>
      </div>

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-sm font-semibold text-white/90">Новости</h2>
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
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              placeholder="Тема"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              placeholder="Опишите проблему…"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void createTicket('draft')}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
              >
                Черновик
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void createTicket('open')}
                className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                Отправить
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Мои обращения</h2>
            <span className="text-xs text-slate-500">
              открыто: {openCount} · черновики: {draftCount}
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
            {tickets.length === 0 ? (
              <div className="bg-slate-950/30 px-4 py-6 text-center text-sm text-slate-400">Пока нет обращений.</div>
            ) : (
              tickets.slice(0, 30).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`block w-full bg-slate-950/30 px-4 py-3 text-left hover:bg-slate-900/50 ${
                    selectedId === t.id ? 'ring-1 ring-emerald-500/40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/85">{t.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {statusLabel(t.status)} · {new Date(t.created_at).toLocaleString()}
                        {t.reply_count > 0 ? ` · ответов: ${t.reply_count}` : ''}
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeTicket(t.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          void removeTicket(t.id)
                        }
                      }}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                    >
                      Удалить
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{t.body}</p>
                </button>
              ))
            )}
          </div>

          {detail ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/30 p-4">
              <div className="text-sm font-semibold text-white/90">Переписка</div>
              <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                {detail.replies.length === 0 ? (
                  <p className="text-xs text-slate-500">Ответов пока нет.</p>
                ) : (
                  detail.replies.map((r) => (
                    <div key={r.id} className="rounded border border-slate-800 px-3 py-2 text-sm">
                      <div className="text-xs text-slate-500">{r.author_email}</div>
                      <div className="mt-1 text-slate-300">{r.body}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Ваш ответ…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void sendReply()}
                  className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-40"
                >
                  Ответить
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
