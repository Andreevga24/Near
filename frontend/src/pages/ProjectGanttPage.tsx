import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { fetchProjectGantt, type GanttData, type GanttTask } from '../api/gantt'
import { listProjects, type Project } from '../api/projects'
import { useAuth } from '../context/AuthContext'

function barStyle(task: GanttTask, rangeStart: number, rangeEnd: number) {
  const start = new Date(task.start_at).getTime()
  const end = new Date(task.end_at).getTime()
  const span = Math.max(rangeEnd - rangeStart, 1)
  const left = ((start - rangeStart) / span) * 100
  const width = Math.max(((end - start) / span) * 100, 2)
  return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` }
}

export function ProjectGanttPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { token, logout } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [gantt, setGantt] = useState<GanttData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !projectId) return
    setError(null)
    setLoading(true)
    try {
      const ps = await listProjects(token)
      const p = ps.find((x) => x.id === projectId) ?? null
      setProject(p)
      const data = await fetchProjectGantt(token, projectId)
      setGantt(data)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить Гант')
    } finally {
      setLoading(false)
    }
  }, [token, projectId, logout])

  useEffect(() => {
    void load()
  }, [load])

  const range = useMemo(() => {
    if (!gantt) return { start: 0, end: 1, labels: [] as string[] }
    const start = new Date(gantt.range_start).getTime()
    const end = new Date(gantt.range_end).getTime()
    const labels: string[] = []
    const days = Math.ceil((end - start) / (24 * 3600 * 1000))
    for (let i = 0; i <= Math.min(days, 14); i++) {
      const d = new Date(start + i * 24 * 3600 * 1000)
      labels.push(d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }))
    }
    return { start, end, labels }
  }, [gantt])

  const taskById = useMemo(() => {
    const m = new Map<string, GanttTask>()
    for (const t of gantt?.tasks ?? []) m.set(t.id, t)
    return m
  }, [gantt])

  return (
    <div>
      <Link to={`/projects/${projectId}`} className="text-sm text-slate-500 hover:text-slate-300">
        ← К доске
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Гант · {project?.name ?? '…'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Полосы по срокам (создание → дедлайн). Стрелки blocks — зависимости «ждёт задачу».
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Обновить
        </button>
      </div>

      {error ? (
        <p className="near-alert-warn mt-4">{error}</p>
      ) : loading ? (
        <p className="mt-10 text-slate-500">Загрузка…</p>
      ) : !gantt || gantt.tasks.length === 0 ? (
        <p className="mt-10 text-slate-500">Нет активных задач с датами для диаграммы.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="min-w-[640px] border-b border-white/10 px-4 py-2">
            <div className="ml-48 flex justify-between text-[10px] text-slate-500">
              {range.labels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-white/5">
            {gantt.tasks.map((task) => {
              const style = barStyle(task, range.start, range.end)
              const blockers = task.blocked_by
                .map((id) => taskById.get(id)?.title)
                .filter(Boolean) as string[]
              return (
                <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-44 shrink-0 truncate text-sm text-slate-200" title={task.title}>
                    {task.title}
                  </div>
                  <div className="relative h-7 flex-1 rounded bg-white/5">
                    <div
                      className="absolute top-1 h-5 rounded bg-violet-500/80"
                      style={style}
                      title={`${task.status} · до ${new Date(task.end_at).toLocaleDateString()}`}
                    />
                  </div>
                  {blockers.length > 0 ? (
                    <span className="shrink-0 text-[10px] text-amber-400/90" title={blockers.join(', ')}>
                      ← {blockers.length}
                    </span>
                  ) : (
                    <span className="w-6 shrink-0" />
                  )}
                </li>
              )
            })}
          </ul>
          {gantt.links.length > 0 ? (
            <p className="border-t border-white/10 px-4 py-3 text-xs text-slate-500">
              Зависимостей blocks: {gantt.links.length}. Цифра ← — число блокирующих задач.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
