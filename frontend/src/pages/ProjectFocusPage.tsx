import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { fetchNextFocusTask, type FocusWeights } from '../api/focus'
import { listProjects, type Project } from '../api/projects'
import { closeTask, listTasks, updateTask, type Task } from '../api/tasks'
import { nextKanbanColumn, orderedBoardColumns, prevKanbanColumn } from '../constants/boardPresets'
import { DEFAULT_PROJECT_KIND, isProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'

const WEIGHTS_KEY = 'near_focus_weights_v1'

const DEFAULT_WEIGHTS: FocusWeights = {
  due_weight: 3,
  priority_weight: 2,
  column_weight: 1,
  exclude_blocked: true,
}

function loadWeights(): FocusWeights {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY)
    if (!raw) return DEFAULT_WEIGHTS
    const v = JSON.parse(raw) as Partial<FocusWeights>
    return {
      due_weight: typeof v.due_weight === 'number' ? v.due_weight : DEFAULT_WEIGHTS.due_weight,
      priority_weight: typeof v.priority_weight === 'number' ? v.priority_weight : DEFAULT_WEIGHTS.priority_weight,
      column_weight: typeof v.column_weight === 'number' ? v.column_weight : DEFAULT_WEIGHTS.column_weight,
      exclude_blocked: v.exclude_blocked !== false,
    }
  } catch {
    return DEFAULT_WEIGHTS
  }
}

export function ProjectFocusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { token, logout } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [focusTask, setFocusTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [weights, setWeights] = useState<FocusWeights>(loadWeights)
  const [skippedIds, setSkippedIds] = useState<string[]>([])

  const projectKind = useMemo(() => {
    if (!project?.kind) return DEFAULT_PROJECT_KIND
    return isProjectKind(project.kind) ? project.kind : DEFAULT_PROJECT_KIND
  }, [project])

  const columns = useMemo(() => orderedBoardColumns(projectKind, tasks), [projectKind, tasks])
  const terminalStatus = columns[columns.length - 1] ?? 'done'

  const reloadFocusOnly = useCallback(async () => {
    if (!token || !projectId) return
    const next = await fetchNextFocusTask(token, projectId, { ...weights, skipIds: skippedIds })
    setFocusTask(next)
  }, [token, projectId, weights, skippedIds])

  const loadAll = useCallback(async () => {
    if (!token || !projectId) return
    setError(null)
    setLoading(true)
    try {
      const plist = await listProjects(token)
      const p = plist.find((x) => x.id === projectId) ?? null
      setProject(p)
      if (!p) {
        setTasks([])
        setFocusTask(null)
        return
      }
      const [tlist, next] = await Promise.all([
        listTasks(token, projectId),
        fetchNextFocusTask(token, projectId, { ...weights, skipIds: skippedIds }),
      ])
      setTasks(tlist)
      setFocusTask(next)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить режим фокуса')
    } finally {
      setLoading(false)
    }
  }, [token, projectId, logout, weights, skippedIds])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights))
  }, [weights])

  const move = useCallback(
    async (dir: 'prev' | 'next') => {
      if (!token || !focusTask) return
      setError(null)
      setSaving(true)
      try {
        const newStatus =
          dir === 'next' ? nextKanbanColumn(focusTask.status, columns) : prevKanbanColumn(focusTask.status, columns)
        await updateTask(token, focusTask.id, { status: newStatus })
        await loadAll()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось обновить задачу')
      } finally {
        setSaving(false)
      }
    },
    [token, focusTask, columns, loadAll, logout],
  )

  const markDone = useCallback(async () => {
    if (!token || !focusTask) return
    setSaving(true)
    setError(null)
    try {
      if (focusTask.status === terminalStatus) {
        await closeTask(token, focusTask.id, true)
      } else {
        await updateTask(token, focusTask.id, { status: terminalStatus })
      }
      setSkippedIds((prev) => prev.filter((id) => id !== focusTask.id))
      await loadAll()
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось завершить задачу')
    } finally {
      setSaving(false)
    }
  }, [token, focusTask, terminalStatus, loadAll])

  const postpone = useCallback(async () => {
    if (!focusTask) return
    setSkippedIds((prev) => (prev.includes(focusTask.id) ? prev : [...prev, focusTask.id]))
    await reloadFocusOnly()
  }, [focusTask, reloadFocusOnly])

  if (!projectId) {
    return <p className="text-slate-400">Не указан проект.</p>
  }

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
  }

  if (!project) {
    return (
      <div>
        <p className="text-slate-400">Проект не найден или у вас нет к нему доступа.</p>
        <Link to="/projects/carousel" className="near-link mt-4 inline-block">
          ← К проектам
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/projects/${projectId}`} className="near-link-muted">
            ← На доску
          </Link>
          <h1 className="near-h1 mt-2">Режим фокуса</h1>
          <p className="near-lead mt-1">Следующая задача с настраиваемыми весами; заблокированные blocks исключаются.</p>
        </div>
        <button type="button" onClick={() => navigate(`/projects/${projectId}`)} className="near-btn-secondary">
          Открыть доску
        </button>
      </div>

      {error ? <p className="near-alert-warn mt-4">{error}</p> : null}

      <section className="near-card mt-6 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-white/90">Веса правил</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['due_weight', 'Дедлайн'],
              ['priority_weight', 'Приоритет'],
              ['column_weight', 'Колонка'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs text-slate-400">
              {label}: {weights[key]}
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="mt-1 w-full"
              />
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={weights.exclude_blocked}
            onChange={(e) => setWeights((w) => ({ ...w, exclude_blocked: e.target.checked }))}
          />
          Исключать задачи, заблокированные связью blocks
        </label>
      </section>

      <section className="near-card mt-6 rounded-2xl">
        {focusTask ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-100">{focusTask.title}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  status: <span className="text-slate-300">{focusTask.status}</span> · priority:{' '}
                  <span className="text-slate-300">{focusTask.priority}</span>
                  {focusTask.due_at ? (
                    <>
                      {' '}
                      · due: <span className="text-slate-300">{new Date(focusTask.due_at).toLocaleString()}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {focusTask.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{focusTask.description}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Без описания.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void markDone()} className="near-btn-primary">
                Сделано
              </button>
              <button type="button" disabled={saving} onClick={() => void postpone()} className="near-btn-secondary">
                Отложить
              </button>
              <button type="button" disabled={saving} onClick={() => void move('prev')} className="near-btn-secondary">
                ← Назад
              </button>
              <button type="button" disabled={saving} onClick={() => void move('next')} className="near-btn-secondary">
                Дальше →
              </button>
              <button type="button" disabled={saving} onClick={() => void reloadFocusOnly()} className="near-btn-secondary">
                Обновить
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-slate-300">Нет задач для фокуса (все отложены, заблокированы или в финальной колонке).</p>
            {skippedIds.length > 0 ? (
              <button
                type="button"
                className="near-btn-secondary mt-3"
                onClick={() => {
                  setSkippedIds([])
                  void loadAll()
                }}
              >
                Сбросить отложенные ({skippedIds.length})
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
