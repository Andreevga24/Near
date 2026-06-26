import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import {
  createChatChannel,
  listChatChannels,
  listChatMessages,
  postChatMessage,
  type ChatChannel,
  type ChatMessage,
} from '../api/messenger'
import { listProjects, type Project } from '../api/projects'
import { chatChannelWebSocketUrl } from '../api/realtime'
import { useAuth } from '../context/AuthContext'

function normalizeTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function MessengerPage() {
  const { user, token, logout } = useAuth()

  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [newChannelTitle, setNewChannelTitle] = useState('')
  const [newChannelProjectId, setNewChannelProjectId] = useState('')
  const [composerText, setComposerText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const listRef = useRef<HTMLDivElement | null>(null)

  const loadChannels = useCallback(async () => {
    if (!token) return
    const [chs, ps] = await Promise.all([listChatChannels(token), listProjects(token)])
    setChannels(chs)
    setProjects(ps)
    if (chs.length === 0) {
      const general = await createChatChannel(token, { title: 'general' })
      setChannels([general])
      setActiveChannelId(general.id)
    } else {
      setActiveChannelId((prev) => (prev && chs.some((c) => c.id === prev) ? prev : chs[0].id))
    }
  }, [token])

  const loadMessages = useCallback(
    async (channelId: string) => {
      if (!token) return
      const msgs = await listChatMessages(token, channelId)
      setMessages(msgs)
    },
    [token],
  )

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    void loadChannels()
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить мессенджер')
      })
      .finally(() => setLoading(false))
  }, [token, loadChannels, logout])

  useEffect(() => {
    if (!token || !activeChannelId) return
    void loadMessages(activeChannelId).catch(() => setMessages([]))
  }, [token, activeChannelId, loadMessages])

  useEffect(() => {
    if (!token || !activeChannelId) return
    const url = chatChannelWebSocketUrl(activeChannelId, token)
    const socket = new WebSocket(url)
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as { type?: string; message?: ChatMessage }
        if (data.type === 'chat_message' && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message!.id)) return prev
            return [...prev, data.message!]
          })
        }
      } catch {
        /* ignore */
      }
    }
    return () => socket.close()
  }, [token, activeChannelId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, activeChannelId])

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0],
    [channels, activeChannelId],
  )

  const createChannel = async () => {
    if (!token) return
    setError(null)
    const title = normalizeTitle(newChannelTitle)
    if (title.length < 2) {
      setError('Название канала слишком короткое')
      return
    }
    if (channels.some((c) => c.title.toLowerCase() === title.toLowerCase())) {
      setError('Канал с таким названием уже есть')
      return
    }
    try {
      const ch = await createChatChannel(token, {
        title,
        project_id: newChannelProjectId || undefined,
      })
      setChannels((prev) => [...prev, ch])
      setActiveChannelId(ch.id)
      setNewChannelTitle('')
      setNewChannelProjectId('')
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось создать канал')
    }
  }

  const sendMessage = async () => {
    if (!token || !activeChannelId || !user) return
    const text = composerText.trim()
    if (!text) return
    setSending(true)
    setError(null)
    try {
      const msg = await postChatMessage(token, activeChannelId, text)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      setComposerText('')
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
  }

  return (
    <div className="min-h-[70vh]">
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-white">Мессенджер</h1>
        <p className="mt-1 text-sm text-slate-400">
          Каналы в базе данных; личные и по проекту. Сообщения в реальном времени через WebSocket.
        </p>
      </div>

      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Каналы</h2>
            <span className="text-xs text-slate-500">{channels.length}</span>
          </div>

          <div className="mt-3 space-y-1">
            {channels.map((c) => {
              const active = c.id === activeChannelId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChannelId(c.id)}
                  className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="truncate">#{c.title}</span>
                  {c.project_id ? (
                    <span className="truncate text-[10px] text-slate-500">проект</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <input
              value={newChannelTitle}
              onChange={(e) => setNewChannelTitle(e.target.value)}
              placeholder="новый канал"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            />
            <select
              value={newChannelProjectId}
              onChange={(e) => setNewChannelProjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            >
              <option value="">Личный канал</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void createChannel()}
              className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
            >
              Создать канал
            </button>
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">
                #{activeChannel?.title ?? 'channel'}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{messages.length} сообщений</div>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/20 px-4 py-6 text-center text-sm text-slate-400">
                Пока пусто. Напиши первое сообщение.
              </div>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-white/85">{m.author_email}</div>
                  <div className="text-[11px] text-slate-500">{new Date(m.created_at).toLocaleString()}</div>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200/90">{m.text}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                rows={2}
                placeholder="Сообщение…"
                disabled={sending}
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void sendMessage()
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending}
                className="shrink-0 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                Отправить
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">Ctrl+Enter для отправки</p>
          </div>
        </section>
      </div>
    </div>
  )
}
