import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { listProjects, type Project } from '../api/projects'
import { listTasks, type Task } from '../api/tasks'
import { useAuth } from '../context/AuthContext'

type FeedItemType = 'project_created' | 'project_updated' | 'task_created' | 'task_updated'

type FeedItem = {
  id: string
  type: FeedItemType
  at: string
  projectId: string
  projectName: string
  taskId?: string
  taskTitle?: string
  href: string
}

function isLikelyCreated(createdAt: string, updatedAt: string): boolean {
  const c = new Date(createdAt).getTime()
  const u = new Date(updatedAt).getTime()
  if (!Number.isFinite(c) || !Number.isFinite(u)) return false
  return Math.abs(u - c) < 2500
}

function labelType(t: FeedItemType): string {
  switch (t) {
    case 'project_created':
      return 'Создан проект'
    case 'project_updated':
      return 'Обновлён проект'
    case 'task_created':
      return 'Создана задача'
    case 'task_updated':
      return 'Обновлена задача'
  }
}

export function FeedPage() {
  const { token, logout } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projectFilter, setProjectFilter] = useState<string>('all')

  const load = useCallback(async () => {
    if (!token) return
    setError(null)
    setLoading(true)
    try {
      const ps = await listProjects(token)
      setProjects(ps)

      const entries = await Promise.all(
        ps.map(async (p) => {
          const ts = await listTasks(token, p.id)
          return [p.id, ts] as const
        }),
      )
      setTasksByProject(Object.fromEntries(entries))
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить ленту')
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo((): FeedItem[] => {
    const out: FeedItem[] = []

    for (const p of projects) {
      const pCreated = isLikelyCreated(p.created_at, p.updated_at)
      out.push({
        id: `project_${p.id}_${pCreated ? 'created' : 'updated'}_${p.updated_at}`,
        type: pCreated ? 'project_created' : 'project_updated',
        at: pCreated ? p.created_at : p.updated_at,
        projectId: p.id,
        projectName: p.name,
        href: `/projects/${p.id}`,
      })

      const tasks = tasksByProject[p.id] ?? []
      for (const t of tasks) {
        const created = isLikelyCreated(t.created_at, t.updated_at)
        out.push({
          id: `task_${t.id}_${created ? 'created' : 'updated'}_${t.updated_at}`,
          type: created ? 'task_created' : 'task_updated',
          at: created ? t.created_at : t.updated_at,
          projectId: p.id,
          projectName: p.name,
          taskId: t.id,
          taskTitle: t.title,
          href: `/projects/${p.id}`,
        })
      }
    }

    const filtered = projectFilter === 'all' ? out : out.filter((x) => x.projectId === projectFilter)
    return filtered
      .filter((x) => !!x.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 200)
  }, [projects, tasksByProject, projectFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>()
    for (const it of items) {
      const d = new Date(it.at)
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
            MVP: события собираются из <span className="text-slate-200">updated_at / created_at</span> проектов и задач.
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
          <button
            type="button"
            onClick={() => void load()}
            className="near-btn-secondary"
          >
            Обновить
          </button>
        </div>
      </div>

      {error ? (
        <p className="near-alert-warn mt-4">{error}</p>
      ) : null}

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
        <p className="mt-10 text-slate-500">Пока нет событий.</p>
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
                      <div className="text-sm text-white/90">{labelType(it.type)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">Проект: {it.projectName}</span>
                        {it.taskTitle ? <span className="truncate">· Задача: {it.taskTitle}</span> : null}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{new Date(it.at).toLocaleTimeString()}</div>
                    <Link
                      to={it.href}
                      className="near-btn-secondary"
                    >
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

