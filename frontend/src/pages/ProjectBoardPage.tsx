/**
 * Доска проекта: задачи в виде нод (React Flow), колонки по типу проекта (kind).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { listProjects, type Project } from '../api/projects'
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type Task,
} from '../api/tasks'
import { TaskBoardGraph } from '../components/board/TaskBoardGraph'
import { TaskBoardKanbanList } from '../components/board/TaskBoardKanbanList'
import {
  firstStatusForKind,
  labelStatusColumn,
  nextKanbanColumn,
  orderedBoardColumns,
} from '../constants/boardPresets'
import { DEFAULT_PROJECT_KIND, isProjectKind, labelProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'
import { emitTasksChanged } from '../nearEvents'

const BOARD_VIEW_STORAGE_KEY = 'near_project_board_view'
type BoardViewMode = 'kanban' | 'nodes'

function readBoardViewMode(): BoardViewMode {
  if (typeof window === 'undefined') return 'kanban'
  return localStorage.getItem(BOARD_VIEW_STORAGE_KEY) === 'nodes' ? 'nodes' : 'kanban'
}

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { token, logout } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [boardView, setBoardView] = useState<BoardViewMode>(readBoardViewMode)

  const setBoardViewPersist = useCallback((mode: BoardViewMode) => {
    setBoardView(mode)
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, mode)
  }, [])

  const loadBoard = useCallback(async () => {
    if (!token || !projectId) return
    setError(null)
    setLoading(true)
    try {
      const plist = await listProjects(token)
      const p = plist.find((x) => x.id === projectId) ?? null
      setProject(p)
      if (p) {
        const tlist = await listTasks(token, projectId)
        setTasks(tlist)
      } else {
        setTasks([])
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить доску')
    } finally {
      setLoading(false)
    }
  }, [token, projectId, logout])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const projectKind = useMemo(() => {
    if (!project?.kind) return DEFAULT_PROJECT_KIND
    return isProjectKind(project.kind) ? project.kind : DEFAULT_PROJECT_KIND
  }, [project])

  const columns = useMemo(
    () => orderedBoardColumns(projectKind, tasks),
    [projectKind, tasks],
  )

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !projectId || !project || !newTitle.trim()) return
    setSaving(true)
    setError(null)
    try {
      const task = await createTask(token, {
        project_id: projectId,
        title: newTitle.trim(),
        status: firstStatusForKind(projectKind),
      })
      setTasks((prev) => [...prev, task])
      emitTasksChanged()
      setNewTitle('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось создать задачу')
    } finally {
      setSaving(false)
    }
  }

  async function moveTask(task: Task) {
    if (!token) return
    const next = nextKanbanColumn(task.status, columns)
    setError(null)
    try {
      const updated = await updateTask(token, task.id, { status: next })
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось обновить задачу')
    }
  }

  const onTaskStatusChange = useCallback(
    async (task: Task, newStatus: string) => {
      if (!token) throw new Error('Нет сессии')
      setError(null)
      try {
        const updated = await updateTask(token, task.id, { status: newStatus })
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          throw err
        }
        setError(
          err instanceof ApiError ? formatApiError(err.body) : 'Не удалось переместить задачу',
        )
        throw err
      }
    },
    [token, logout],
  )

  async function handleDeleteTask(task: Task) {
    if (!token) return
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return
    setError(null)
    try {
      await deleteTask(token, task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      emitTasksChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Ошибка удаления')
    }
  }

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
        <Link to="/projects/carousel" className="mt-4 inline-block text-violet-400 hover:text-violet-300">
          ← К проектам
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
            ← Все проекты
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
            <span className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400">
              {labelProjectKind(projectKind)}
            </span>
          </div>
          {project.description ? (
            <p className="mt-2 max-w-2xl text-slate-400">{project.description}</p>
          ) : null}
          <p className="mt-3 max-w-2xl text-xs text-slate-600">
            Тип проекта задаётся при создании. В режиме «Ноды» перетащите карточку в другую колонку для смены статуса.
            «Дальше →» в обоих режимах ведёт по порядку колонок.
          </p>
        </div>
        <div className="shrink-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Вид доски</p>
          <div
            className="mt-1 inline-flex rounded-lg border border-slate-700 bg-slate-900/80 p-0.5"
            role="group"
            aria-label="Режим отображения доски"
          >
            <button
              type="button"
              onClick={() => setBoardViewPersist('kanban')}
              className={
                boardView === 'kanban'
                  ? 'rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }
            >
              Канбан
            </button>
            <button
              type="button"
              onClick={() => setBoardViewPersist('nodes')}
              className={
                boardView === 'nodes'
                  ? 'rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }
            >
              Ноды
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleAddTask}
        className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1 text-sm">
          <span className="text-slate-500">Новая задача</span>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
            placeholder="Что нужно сделать?"
            maxLength={500}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !newTitle.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving
            ? 'Добавление…'
            : `Добавить в «${labelStatusColumn(firstStatusForKind(projectKind))}»`}
        </button>
      </form>

      <div className="mt-8">
        {boardView === 'kanban' ? (
          <TaskBoardKanbanList
            columns={columns}
            tasks={tasks}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
          />
        ) : (
          <TaskBoardGraph
            kind={projectKind}
            columns={columns}
            tasks={tasks}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
            onTaskStatusChange={onTaskStatusChange}
          />
        )}
      </div>
    </div>
  )
}
