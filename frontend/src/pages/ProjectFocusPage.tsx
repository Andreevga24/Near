import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { fetchNextFocusTask } from '../api/focus'
import { listProjects, type Project } from '../api/projects'
import { listTasks, updateTask, type Task } from '../api/tasks'
import { nextKanbanColumn, orderedBoardColumns, prevKanbanColumn } from '../constants/boardPresets'
import { DEFAULT_PROJECT_KIND, isProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'

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

  const projectKind = useMemo(() => {
    if (!project?.kind) return DEFAULT_PROJECT_KIND
    return isProjectKind(project.kind) ? project.kind : DEFAULT_PROJECT_KIND
  }, [project])

  const columns = useMemo(() => orderedBoardColumns(projectKind, tasks), [projectKind, tasks])

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
      const [tlist, next] = await Promise.all([listTasks(token, projectId), fetchNextFocusTask(token, projectId)])
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
  }, [token, projectId, logout])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const reloadFocusOnly = useCallback(async () => {
    if (!token || !projectId) return
    const next = await fetchNextFocusTask(token, projectId)
    setFocusTask(next)
  }, [token, projectId])

  const move = useCallback(
    async (dir: 'prev' | 'next') => {
      if (!token || !focusTask) return
      setError(null)
      setSaving(true)
      try {
        const newStatus =
          dir === 'next' ? nextKanbanColumn(focusTask.status, columns) : prevKanbanColumn(focusTask.status, columns)
        await updateTask(token, focusTask.id, { status: newStatus })
        await Promise.all([loadAll(), reloadFocusOnly()])
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
    [token, focusTask, columns, loadAll, reloadFocusOnly, logout],
  )

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
          <p className="near-lead mt-1">Следующая задача по дедлайну, приоритету, колонке и давности.</p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="near-btn-secondary"
          >
            Открыть доску
          </button>
        </div>
      </div>

      {error ? (
        <p className="near-alert-warn mt-4">{error}</p>
      ) : null}

      <section className="near-card mt-8 rounded-2xl">
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
              <button
                type="button"
                disabled={saving}
                onClick={() => void move('prev')}
                className="near-btn-secondary"
              >
                ← Назад
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void move('next')}
                className="near-btn-primary"
              >
                Дальше →
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void reloadFocusOnly()}
                className="near-btn-secondary"
              >
                Обновить
              </button>
            </div>
          </>
        ) : (
          <div>
            <p className="text-slate-300">Нет задач для фокуса (все в “done/closed”, либо проект пуст).</p>
            <p className="mt-2 text-sm text-slate-500">
              Вернитесь на доску и создайте задачу, или переместите её из финальной колонки.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

