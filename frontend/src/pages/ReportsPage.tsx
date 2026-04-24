import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { listProjects, type Project } from '../api/projects'
import { listTasks, type Task } from '../api/tasks'
import { useAuth } from '../context/AuthContext'

type StatusStat = { status: string; count: number }

function fmtInt(n: number): string {
  return new Intl.NumberFormat().format(n)
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('готов') || s.includes('закры')) return 'bg-emerald-500/80'
  if (s.includes('progress') || s.includes('doing') || s.includes('в работ')) return 'bg-violet-500/80'
  if (s.includes('review') || s.includes('проверк')) return 'bg-amber-500/80'
  if (s.includes('blocked') || s.includes('block') || s.includes('стоп')) return 'bg-red-500/80'
  return 'bg-slate-500/80'
}

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

function buildStats(tasks: Task[]) {
  const now = Date.now()
  const week = now + 7 * 24 * 60 * 60 * 1000

  let withDue = 0
  let overdue = 0
  let dueSoon = 0

  const byStatus = new Map<string, number>()
  for (const t of tasks) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
    const dueMs = parseIsoMs(t.due_at)
    if (dueMs != null) {
      withDue += 1
      if (dueMs < now) overdue += 1
      else if (dueMs <= week) dueSoon += 1
    }
  }

  const statusStats: StatusStat[] = Array.from(byStatus.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))

  return { withDue, overdue, dueSoon, statusStats }
}

export function ReportsPage() {
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
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить отчёты')
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') {
      return Object.values(tasksByProject).flat()
    }
    return tasksByProject[projectFilter] ?? []
  }, [tasksByProject, projectFilter])

  const selectedProjectName = useMemo(() => {
    if (projectFilter === 'all') return 'Все проекты'
    return projects.find((p) => p.id === projectFilter)?.name ?? 'Проект'
  }, [projects, projectFilter])

  const stats = useMemo(() => buildStats(filteredTasks), [filteredTasks])
  const total = filteredTasks.length
  const doneLike = useMemo(() => {
    const done = filteredTasks.filter((t) => t.status.toLowerCase().includes('done') || t.status.toLowerCase().includes('готов')).length
    return done
  }, [filteredTasks])

  const completion = total > 0 ? clamp01(doneLike / total) : 0

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Отчёты</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Быстрая сводка по задачам: статусы и дедлайны. Источник — текущие проекты и задачи.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
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
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Обновить
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-slate-500">Загрузка…</p>
      ) : projects.length === 0 ? (
        <p className="mt-10 text-slate-500">
          Пока нет проектов —{' '}
          <Link to="/projects" className="text-violet-400 hover:text-violet-300">
            создайте первый
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{selectedProjectName}</div>
                <div className="mt-1 text-xs text-slate-500">Данные: задачи (до 7 дней вперёд по дедлайнам)</div>
              </div>
              <div className="w-full max-w-sm">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Готово (приблизительно)</span>
                  <span>{Math.round(completion * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-emerald-500/80" style={{ width: `${Math.round(completion * 100)}%` }} />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Всего задач</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(total)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">С дедлайном</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(stats.withDue)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Просрочено</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(stats.overdue)}</div>
              {stats.overdue > 0 ? <div className="mt-1 text-xs text-red-200/80">Нужно внимание</div> : null}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Дедлайн ≤ 7 дней</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(stats.dueSoon)}</div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="border-b border-white/10 px-5 py-3">
              <div className="text-sm font-semibold text-white/90">По статусам</div>
              <div className="mt-0.5 text-xs text-slate-500">Топ-12 (для читаемости)</div>
            </div>
            <div className="p-5">
              {stats.statusStats.length === 0 ? (
                <p className="text-sm text-slate-500">Нет задач.</p>
              ) : (
                <div className="space-y-3">
                  {stats.statusStats.slice(0, 12).map((s) => {
                    const p = total > 0 ? (s.count / total) * 100 : 0
                    return (
                      <div key={s.status} className="grid grid-cols-[1fr,64px] items-center gap-3">
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="truncate text-sm text-white/90">{s.status}</div>
                            <div className="text-xs text-slate-500">{Math.round(p)}%</div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full ${statusColor(s.status)}`} style={{ width: `${Math.max(2, Math.round(p))}%` }} />
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums text-white/85">{fmtInt(s.count)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <p className="text-xs text-slate-600">
            Дальше можно добавить: экспорт CSV, “выполнено к сроку”, динамику за 7/30 дней (нужен backend-агрегат или расширение данных).
          </p>
        </div>
      )}
    </div>
  )
}

