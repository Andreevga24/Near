/**
 * Архив закрытых задач проекта.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { listProjects, type Project } from '../api/projects'
import {
  archiveDaysLeft,
  listArchivedTasks,
  purgeArchivedTasks,
  restoreTask,
  type Task,
} from '../api/tasks'
import { labelProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'
import { emitTasksChanged } from '../nearEvents'

type CompletedFilter = 'all' | 'completed' | 'not_completed'

export function ProjectArchivePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { token, logout } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)
  const [completedFilter, setCompletedFilter] = useState<CompletedFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!token || !projectId) return
    setError(null)
    setLoading(true)
    try {
      const [plist, archived] = await Promise.all([
        listProjects(token),
        listArchivedTasks(token, projectId),
      ])
      setProject(plist.find((p) => p.id === projectId) ?? null)
      setTasks(archived.tasks)
      setRetentionDays(archived.retention_days)
      setSelected(new Set())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить архив')
    } finally {
      setLoading(false)
    }
  }, [token, projectId, logout])

  useEffect(() => {
    void load()
  }, [load])

  const filteredTasks = useMemo(() => {
    if (completedFilter === 'all') return tasks
    if (completedFilter === 'completed') return tasks.filter((t) => t.completed === true)
    return tasks.filter((t) => t.completed !== true)
  }, [tasks, completedFilter])

  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selected.has(t.id))

  function toggleSelect(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const t of filteredTasks) next.delete(t.id)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const t of filteredTasks) next.add(t.id)
        return next
      })
    }
  }

  async function handleRestore(task: Task) {
    if (!token) return
    setBusyId(task.id)
    setError(null)
    try {
      await restoreTask(token, task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
      emitTasksChanged()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось восстановить задачу')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePurgeSelected() {
    if (!token || selected.size === 0) return
    const n = selected.size
    if (!window.confirm(`Безвозвратно удалить ${n} задач(и) из архива?`)) return
    setPurging(true)
    setError(null)
    try {
      await purgeArchivedTasks(token, [...selected])
      setTasks((prev) => prev.filter((t) => !selected.has(t.id)))
      setSelected(new Set())
      emitTasksChanged()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось удалить задачи')
    } finally {
      setPurging(false)
    }
  }

  if (!projectId) {
    return <p className="text-slate-400">Не указан проект.</p>
  }

  if (loading) {
    return <p className="text-slate-500">Загрузка архива…</p>
  }

  if (!project) {
    return (
      <div>
        <p className="text-slate-400">Проект не найден.</p>
        <Link to="/projects/carousel" className="near-link mt-4 inline-block">
          ← К проектам
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to={`/projects/${projectId}`} className="near-link-muted">
        ← Доска проекта
      </Link>
      <h1 className="near-h1 mt-2">Архив задач</h1>
      <p className="near-lead">
        {project.name} · {labelProjectKind(project.kind)}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Закрытые задачи хранятся {retentionDays} дн. (настраивается в backend через{' '}
        <code className="text-slate-400">TASK_ARCHIVE_RETENTION_DAYS</code>), затем удаляются автоматически.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">
          Статус
          <select
            value={completedFilter}
            onChange={(e) => setCompletedFilter(e.target.value as CompletedFilter)}
            className="near-input ml-2 mt-0 inline-block w-auto py-1.5 text-sm"
          >
            <option value="all">Все</option>
            <option value="completed">Выполненные</option>
            <option value="not_completed">Не выполненные</option>
          </select>
        </label>
        {filteredTasks.length > 0 ? (
          <>
            <button type="button" onClick={toggleSelectAll} className="near-btn-secondary text-xs">
              {allFilteredSelected ? 'Снять выделение' : 'Выбрать все'}
            </button>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={() => void handlePurgeSelected()}
                disabled={purging}
                className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-950/50 disabled:opacity-50"
              >
                {purging ? 'Удаление…' : `Удалить выбранные (${selected.size})`}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? <p className="near-alert-warn mt-4">{error}</p> : null}

      <div className="mt-6 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
        {filteredTasks.length === 0 ? (
          <div className="bg-slate-950/30 px-4 py-10 text-center text-sm text-slate-400">
            {tasks.length === 0 ? 'В архиве пока нет задач.' : 'Нет задач по выбранному фильтру.'}
          </div>
        ) : (
          filteredTasks.map((t) => {
            const daysLeft = t.closed_at ? archiveDaysLeft(t.closed_at, retentionDays) : 0
            const completed = t.completed === true
            const checked = selected.has(t.id)
            return (
              <div
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-3 bg-slate-950/30 px-4 py-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(t.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900"
                    aria-label={`Выбрать «${t.title}»`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white/90">{t.title}</h2>
                      <span
                        className={
                          completed
                            ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300'
                            : 'rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200'
                        }
                      >
                        {completed ? 'Выполнена' : 'Не выполнена'}
                      </span>
                    </div>
                    {t.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-400">{t.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Закрыта: {t.closed_at ? new Date(t.closed_at).toLocaleString() : '—'}
                      {' · '}
                      Осталось в архиве: {daysLeft} дн.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRestore(t)}
                  disabled={busyId === t.id}
                  className="near-btn-secondary shrink-0 text-sm disabled:opacity-50"
                >
                  {busyId === t.id ? '…' : 'Вернуть на доску'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
