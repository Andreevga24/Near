import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { feedTypeLabel, listFeed, type FeedItem } from '../api/feed'
import { listProjects, type Project } from '../api/projects'
import { useAuth } from '../context/AuthContext'

export function FeedPage() {
  const { token, logout } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const load = useCallback(async () => {
    if (!token) return
    setError(null)
    setLoading(true)
    try {
      const [ps, feed] = await Promise.all([
        listProjects(token),
        listFeed(token, projectFilter === 'all' ? undefined : projectFilter),
      ])
      setProjects(ps)
      setItems(feed.items)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить ленту')
    } finally {
      setLoading(false)
    }
  }, [token, logout, projectFilter])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>()
    for (const it of items) {
      const d = new Date(it.created_at)
      const key = Number.isFinite(d.getTime()) ? d.toLocaleDateString() : 'Неизвестная дата'
      const arr = map.get(key) ?? []
      arr.push(it)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div>
      <Link to="/projects/carousel" className="near-link-muted">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="near-h1">Лента событий</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            События по задачам из ваших проектов: статусы, комментарии, закрытие и назначения.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="near-input max-w-[240px] text-sm"
          >
            <option value="all">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void load()} className="near-btn-secondary">
            Обновить
          </button>
        </div>
      </div>

      {error ? <p className="near-alert-warn mt-4">{error}</p> : null}

      {loading ? (
        <p className="mt-10 text-slate-500">Загрузка…</p>
      ) : projects.length === 0 ? (
        <p className="mt-10 text-slate-500">
          Пока нет проектов —{' '}
          <Link to="/projects" className="near-link">
            создайте первый
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-slate-500">Пока нет событий. Создайте задачу или оставьте комментарий.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {grouped.map(([day, arr]) => (
            <section key={day} className="near-card p-0">
              <div className="border-b border-slate-800/80 px-5 py-3">
                <div className="text-sm font-semibold text-white/90">{day}</div>
              </div>
              <div className="divide-y divide-slate-800">
                {arr.map((it) => (
                  <div key={it.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white/90">{feedTypeLabel(it.type)}</div>
                      <div className="mt-0.5 text-sm text-slate-300">{it.summary}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">Проект: {it.project_name}</span>
                        {it.actor_email ? <span>· {it.actor_email}</span> : null}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{new Date(it.created_at).toLocaleTimeString()}</div>
                    <Link to={it.href} className="near-btn-secondary">
                      Открыть
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
