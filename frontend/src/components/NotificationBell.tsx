import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../api/auth'
import {
  emitNotificationsChanged,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type Notification,
} from '../api/notifications'
import { useAuth } from '../context/AuthContext'

export function NotificationBell() {
  const { token, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await listNotifications(token, 30)
      setItems(res.items)
      setUnread(res.unread_count)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    void load()
    const onChange = () => void load()
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange)
    const t = window.setInterval(() => void load(), 60_000)
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange)
      window.clearInterval(t)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function handleMarkAll() {
    if (!token) return
    try {
      await markAllNotificationsRead(token)
      emitNotificationsChanged()
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout()
    }
  }

  async function handleOpen(n: Notification) {
    if (!token) return
    if (!n.read_at) {
      try {
        await markNotificationsRead(token, [n.id])
        emitNotificationsChanged()
        setUnread((c) => Math.max(0, c - 1))
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      } catch {
        /* ignore */
      }
    }
    setOpen(false)
  }

  if (!token) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
        className="relative rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
        aria-label="Уведомления"
        title="Уведомления"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 17H9l-1 2h8l-1-2ZM18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <span className="text-sm font-medium text-white">Уведомления</span>
            <div className="flex gap-2">
              {unread > 0 ? (
                <button type="button" onClick={() => void handleMarkAll()} className="text-xs text-slate-400 hover:text-white">
                  Прочитать все
                </button>
              ) : null}
              <Link to="/workspace/feed" className="text-xs text-emerald-400 hover:text-emerald-300" onClick={() => setOpen(false)}>
                Лента →
              </Link>
            </div>
          </div>
          <div className="max-h-[min(60vh,400px)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Загрузка…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Нет уведомлений</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  to={n.link ?? '/workspace/feed'}
                  onClick={() => void handleOpen(n)}
                  className={`block border-b border-slate-800/80 px-3 py-2.5 hover:bg-slate-900/80 ${
                    n.read_at ? 'opacity-70' : 'bg-slate-900/40'
                  }`}
                >
                  <p className="text-sm font-medium text-white/90">{n.title}</p>
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p> : null}
                  <p className="mt-1 text-[10px] text-slate-600">{new Date(n.created_at).toLocaleString()}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
