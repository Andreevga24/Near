import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useWorkspaceStore } from '../hooks/useWorkspaceStore'

type Channel = {
  id: string
  title: string
  createdAt: string
}

type Message = {
  id: string
  channelId: string
  authorEmail: string
  text: string
  createdAt: string
}

type MessengerState = {
  channels: Channel[]
  messages: Message[]
  updatedAt: string
}

const DEFAULT_STATE: MessengerState = {
  channels: [
    { id: 'general', title: 'general', createdAt: new Date(0).toISOString() },
    { id: 'team', title: 'team', createdAt: new Date(0).toISOString() },
  ],
  messages: [],
  updatedAt: new Date(0).toISOString(),
}

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function safeParseState(raw: string | null): MessengerState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<MessengerState> | null
    if (!v || typeof v !== 'object') return null
    return {
      channels: Array.isArray(v.channels)
        ? v.channels
            .filter((c): c is Channel => !!c && typeof c === 'object')
            .map((c) => ({
              id: typeof c.id === 'string' ? c.id : makeId(),
              title: typeof c.title === 'string' ? c.title : 'channel',
              createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
            }))
        : DEFAULT_STATE.channels,
      messages: Array.isArray(v.messages)
        ? v.messages
            .filter((m): m is Message => !!m && typeof m === 'object')
            .map((m) => ({
              id: typeof m.id === 'string' ? m.id : makeId(),
              channelId: typeof m.channelId === 'string' ? m.channelId : 'general',
              authorEmail: typeof m.authorEmail === 'string' ? m.authorEmail : 'unknown@example.local',
              text: typeof m.text === 'string' ? m.text : '',
              createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
            }))
            .filter((m) => m.text.length > 0)
        : DEFAULT_STATE.messages,
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : DEFAULT_STATE.updatedAt,
    }
  } catch {
    return null
  }
}

export function MessengerPage() {
  const { user } = useAuth()
  const legacyStorageKey = useMemo(() => (user ? `near_messenger_v1_${user.id}` : null), [user])

  const {
    data: state,
    setData: setState,
    loading,
    dirty,
    savedAt,
    error: storeError,
    setError,
    saving,
    save,
    reset,
  } = useWorkspaceStore<MessengerState>({
    storeKey: 'messenger',
    defaultValue: DEFAULT_STATE,
    legacyStorageKey,
    parseLegacy: safeParseState,
  })

  const [activeChannelId, setActiveChannelId] = useState<string>('general')
  const [newChannelTitle, setNewChannelTitle] = useState('')
  const [composerText, setComposerText] = useState('')

  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (loading) return
    setActiveChannelId((prev) => {
      if (state.channels.some((c) => c.id === prev)) return prev
      return state.channels[0]?.id ?? 'general'
    })
  }, [loading, state.channels])

  const messagesForActive = useMemo(
    () => state.messages.filter((m) => m.channelId === activeChannelId).slice(-200),
    [state.messages, activeChannelId],
  )

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messagesForActive.length, activeChannelId])

  const createChannel = () => {
    setError(null)
    const title = normalizeTitle(newChannelTitle)
    if (title.length < 2) {
      setError('Название канала слишком короткое')
      return
    }
    if (state.channels.some((c) => c.title.toLowerCase() === title.toLowerCase())) {
      setError('Канал с таким названием уже есть')
      return
    }
    const id = makeId()
    setState({
      ...state,
      channels: [...state.channels, { id, title, createdAt: new Date().toISOString() }],
    })
    setActiveChannelId(id)
    setNewChannelTitle('')
  }

  const sendMessage = () => {
    setError(null)
    const text = composerText.trim()
    if (!text || !user) return
    setState({
      ...state,
      messages: [
        ...state.messages,
        {
          id: makeId(),
          channelId: activeChannelId,
          authorEmail: user.email,
          text,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    setComposerText('')
  }

  const activeChannel = state.channels.find((c) => c.id === activeChannelId) ?? state.channels[0]

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
  }

  return (
    <div className="min-h-[70vh]">
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Мессенджер</h1>
          <p className="mt-1 text-sm text-slate-400">
            Каналы и сообщения сохраняются на сервере для вашей учётной записи.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reset()}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {savedAt ? <p className="mt-2 text-xs text-slate-500">Сохранено: {new Date(savedAt).toLocaleString()}</p> : null}
      {storeError ? <p className="mt-2 text-xs text-amber-200/90">{storeError}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/90">Каналы</h2>
            <span className="text-xs text-slate-500">{state.channels.length}</span>
          </div>

          <div className="mt-3 space-y-1">
            {state.channels.map((c) => {
              const active = c.id === activeChannelId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChannelId(c.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="truncate">#{c.title}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="grid grid-cols-[1fr,auto] gap-2">
              <input
                value={newChannelTitle}
                onChange={(e) => setNewChannelTitle(e.target.value)}
                placeholder="новый канал"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
              <button
                type="button"
                onClick={createChannel}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
              >
                +
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">#{activeChannel?.title ?? 'channel'}</div>
              <div className="mt-0.5 text-xs text-slate-500">{messagesForActive.length} сообщений</div>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-auto px-4 py-4">
            {messagesForActive.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/20 px-4 py-6 text-center text-sm text-slate-400">
                Пока пусто. Напиши первое сообщение.
              </div>
            ) : null}
            {messagesForActive.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="truncate text-xs font-semibold text-white/85">{m.authorEmail}</div>
                  <div className="text-[11px] text-slate-500">{new Date(m.createdAt).toLocaleString()}</div>
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
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                className="shrink-0 rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Отправить
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">Совет: Ctrl+Enter для отправки. Не забудьте нажать «Сохранить».</p>
          </div>
        </section>
      </div>
    </div>
  )
}
