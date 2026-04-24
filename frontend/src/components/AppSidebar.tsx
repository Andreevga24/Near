/**
 * Левая навигация в стиле референса: тёмно-зелёный фон, секции, вложенные проекты.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { drainOfflineQueue, getOfflineQueueSize, OFFLINE_QUEUE_CHANGED_EVENT } from '../api/offlineQueue'
import { listProjects, type Project } from '../api/projects'
import { listTasks } from '../api/tasks'
import { API_BASE_URL } from '../config'
import { useAuth } from '../context/AuthContext'
import { NEAR_PROJECTS_CHANGED, NEAR_TASKS_CHANGED } from '../nearEvents'

const SIDEBAR_COLLAPSE_KEY = 'near_sidebar_collapsed'
const SIDEBAR_BG = 'bg-slate-950/60'

function initialsFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '?').trim()
  const parts = local.split(/[._\s-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase() || '?'
}

function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconPanels({ className }: { className?: string } = {}) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h7v7H4V5ZM13 5h7v4h-7V5ZM13 11h7v8h-7v-8ZM4 14h7v5H4v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMessage({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10h.01M12 10h.01M16 10h.01M4 18l2-4h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M9 19V9M14 19v-6M19 19V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6M8 13h8M8 17h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLifebuoy({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.9 2.9M15.5 15.5l2.9 2.9M5.6 18.4l2.9-2.9M15.5 8.5l2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPanelCollapse({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6v12M9 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPanelExpand({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6v12M15 9l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type RowProps = {
  icon: ReactNode
  label: string
  to?: string
  /** Контент справа (счётчик, плюс). */
  end?: ReactNode
  /** Только точное совпадение пути (для «Мои задачи» vs доска проекта). */
  endPath?: boolean
  nested?: boolean
  collapsed: boolean
  title?: string
}

function SidebarRow({ icon, label, to, end, endPath, nested, collapsed, title }: RowProps) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white/90">{icon}</span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate text-sm text-white/90">{label}</span> : null}
      {!collapsed && end ? <span className="shrink-0">{end}</span> : null}
    </>
  )
  const base =
    'flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/40'
  const pad = nested ? 'pl-2' : ''

  if (to) {
    return (
      <NavLink
        to={to}
        end={endPath}
        title={collapsed ? title ?? label : undefined}
        className={({ isActive }) =>
          `${base} ${pad} ${isActive ? 'bg-white/10 shadow-sm' : ''} ${collapsed ? 'justify-center px-1' : ''}`
        }
      >
        {inner}
      </NavLink>
    )
  }

  return (
    <div
      title={collapsed ? title ?? label : title}
      className={`${base} cursor-default text-white/50 ${pad} ${collapsed ? 'justify-center px-1' : ''}`}
    >
      {inner}
    </div>
  )
}

export function AppSidebar() {
  const { token, user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1' : false,
  )
  const [projects, setProjects] = useState<Project[]>([])
  const [taskTotal, setTaskTotal] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tasksRefreshNonce, setTasksRefreshNonce] = useState(0)
  const [queueSize, setQueueSize] = useState(() => (typeof window !== 'undefined' ? getOfflineQueueSize() : 0))
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))

  const persistCollapse = useCallback((next: boolean) => {
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0')
  }, [])

  const loadProjects = useCallback(async () => {
    if (!token) return
    setLoadError(null)
    try {
      const list = await listProjects(token)
      setProjects(list)
    } catch (e) {
      setProjects([])
      if (e instanceof ApiError) {
        setLoadError(formatApiError(e.body))
      }
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void loadProjects()
  }, [token, loadProjects])

  useEffect(() => {
    if (!token) return
    const onListChanged = () => void loadProjects()
    window.addEventListener(NEAR_PROJECTS_CHANGED, onListChanged)
    return () => window.removeEventListener(NEAR_PROJECTS_CHANGED, onListChanged)
  }, [token, loadProjects])

  useEffect(() => {
    const onTasksChanged = () => setTasksRefreshNonce((n) => n + 1)
    window.addEventListener(NEAR_TASKS_CHANGED, onTasksChanged)
    return () => window.removeEventListener(NEAR_TASKS_CHANGED, onTasksChanged)
  }, [])

  const projectIdsKey = useMemo(
    () =>
      projects
        .map((p) => p.id)
        .sort()
        .join(','),
    [projects],
  )

  useEffect(() => {
    if (!token || !projectIdsKey) {
      setTaskTotal(0)
      return
    }
    const ids = projectIdsKey.split(',').filter(Boolean)
    let cancelled = false
    ;(async () => {
      try {
        const batches = await Promise.all(ids.map((id) => listTasks(token, id)))
        if (!cancelled) setTaskTotal(batches.reduce((n, arr) => n + arr.length, 0))
      } catch {
        if (!cancelled) setTaskTotal(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, projectIdsKey, tasksRefreshNonce])

  useEffect(() => {
    const update = () => setQueueSize(getOfflineQueueSize())
    const onOnline = () => {
      setOnline(true)
      update()
    }
    const onOffline = () => {
      setOnline(false)
      update()
    }
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, update)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    update()
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, update)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!token) return
    setSyncing(true)
    try {
      await drainOfflineQueue({ token, apiBaseUrl: API_BASE_URL })
    } finally {
      setQueueSize(getOfflineQueueSize())
      setSyncing(false)
    }
  }, [token])

  if (!user) {
    return null
  }

  const asideWidth = collapsed ? 'w-[72px]' : 'w-[260px]'

  return (
    <aside
      className={`${SIDEBAR_BG} flex shrink-0 flex-col border-r border-slate-800/80 text-white backdrop-blur transition-[width] duration-200 ease-out ${asideWidth}`}
    >
      <div
        className={`flex items-center border-b border-slate-800/80 ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3'}`}
      >
        {!collapsed ? (
          <Link to="/" className="text-sm font-semibold tracking-tight text-white/95 hover:text-white">
            Near
          </Link>
        ) : (
          <Link
            to="/"
            title="Near"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white/90 hover:bg-white/10"
          >
            N
          </Link>
        )}
      </div>

      <div
        className={`flex items-center gap-2 border-b border-slate-800/80 py-2 ${collapsed ? 'flex-col px-1' : 'px-2'}`}
      >
        <NavLink
          to="/settings"
          title={collapsed ? 'Мой профиль' : undefined}
          className={({ isActive }) =>
            `flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.06] ${isActive ? 'bg-white/10' : ''} ${collapsed ? 'w-full justify-center' : 'flex-1'}`
          }
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-slate-950">
            {initialsFromEmail(user.email)}
          </span>
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/95">Мой профиль</span>
          ) : null}
        </NavLink>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => persistCollapse(!collapsed)}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Свернуть панель"
          >
            <IconPanelCollapse />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => persistCollapse(!collapsed)}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Развернуть панель"
          >
            <IconPanelExpand />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        <div className="space-y-0.5">
          {!collapsed ? (
            <div className="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-white/[0.04]">
              <NavLink
                to="/projects/carousel"
                title="Проекты"
                className={({ isActive }) =>
                  `flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06] ${
                    isActive ? 'bg-white/10' : ''
                  }`
                }
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white/90">
                  <IconPanels className="opacity-90" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">Проекты</span>
                <span className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-0.5 text-xs tabular-nums text-white/90">
                  {taskTotal}
                </span>
              </NavLink>
              <Link
                to="/projects"
                className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
                title="Новый проект"
                aria-label="Создать проект"
              >
                <span className="text-lg leading-none">+</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <NavLink
                to="/projects/carousel"
                title="Проекты"
                className={({ isActive }) =>
                  `flex justify-center rounded-lg p-2 hover:bg-white/[0.06] ${isActive ? 'bg-white/10' : ''}`
                }
              >
                <IconPanels />
              </NavLink>
              <Link
                to="/projects"
                title="Новый проект"
                className="rounded-md p-1 text-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Создать проект"
              >
                +
              </Link>
            </div>
          )}
          {!collapsed && loadError ? (
            <p className="px-2 text-xs text-amber-200/90">{loadError}</p>
          ) : null}
        </div>

        <SidebarRow
          collapsed={collapsed}
          icon={<IconBriefcase className="opacity-90" />}
          label="Моя компания"
          to="/workspace/company"
          title="Моя компания"
        />

        <div className="my-2 border-t border-slate-800/80" />

        <SidebarRow
          collapsed={collapsed}
          icon={<IconMessage className="opacity-90" />}
          label="Мессенджер"
          to="/workspace/messenger"
          title="Мессенджер"
        />
      </div>

      <div className="mt-auto space-y-0.5 border-t border-slate-800/80 px-2 py-3">
        <SidebarRow
          collapsed={collapsed}
          icon={<IconLifebuoy />}
          label={online ? 'Синхронизация' : 'Оффлайн'}
          title={online ? 'Синхронизация (оффлайн-очередь)' : 'Оффлайн-очередь'}
          end={
            queueSize > 0 ? (
              <span className="rounded bg-amber-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {queueSize}
              </span>
            ) : null
          }
        />
        {!collapsed ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={!online || syncing || queueSize === 0}
            className="mb-2 w-full rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-white/85 hover:bg-white/10 disabled:opacity-40"
          >
            {syncing ? 'Синхронизация…' : queueSize > 0 ? 'Синхронизировать сейчас' : 'Очередь пуста'}
          </button>
        ) : null}
        <SidebarRow
          collapsed={collapsed}
          icon={<IconClipboard />}
          label="Лента событий"
          to="/workspace/feed"
          title="Лента событий"
        />
        <SidebarRow
          collapsed={collapsed}
          icon={<IconChart />}
          label="Отчёты"
          to="/workspace/reports"
          title="Отчёты"
        />
        <SidebarRow
          collapsed={collapsed}
          icon={<IconDoc />}
          label="Лицензия и оплаты"
          to="/workspace/billing"
          title="Лицензия и оплаты"
        />
        <SidebarRow
          collapsed={collapsed}
          icon={<IconLifebuoy />}
          label="Поддержка, Новости"
          to="/workspace/support"
          title="Поддержка и новости"
          end={
            <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">+2</span>
          }
        />

        <button
          type="button"
          onClick={() => void logout()}
          className={`mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/30 py-2 text-sm text-white/85 hover:bg-white/10 ${collapsed ? 'px-1' : 'px-3'}`}
        >
          {collapsed ? '⎋' : 'Выйти'}
        </button>
      </div>
    </aside>
  )
}
