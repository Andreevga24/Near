/**
 * Канбан задач проекта (колонки todo / in_progress / done и прочие статусы).
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
import { useAuth } from '../context/AuthContext'

const MAIN_STATUSES = ['todo', 'in_progress', 'done'] as const

const STATUS_LABEL: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
}

function labelForStatus(s: string): string {
  return STATUS_LABEL[s] ?? s
}

function orderedStatuses(tasks: Task[]): string[] {
  const present = new Set(tasks.map((t) => t.status))
  const extra = [...present].filter((s) => !MAIN_STATUSES.includes(s as (typeof MAIN_STATUSES)[number])).sort()
  return [...MAIN_STATUSES, ...extra]
}

function nextKanbanStatus(current: string): string {
  const idx = MAIN_STATUSES.indexOf(current as (typeof MAIN_STATUSES)[number])
  if (idx === -1) return MAIN_STATUSES[0]
  return MAIN_STATUSES[(idx + 1) % MAIN_STATUSES.length]
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

  const columns = useMemo(() => orderedStatuses(tasks), [tasks])

  const tasksByStatus = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      const arr = m.get(t.status) ?? []
      arr.push(t)
      m.set(t.status, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    }
    return m
  }, [tasks])

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !projectId || !newTitle.trim()) return
    setSaving(true)
    setError(null)
    try {
      const task = await createTask(token, {
        project_id: projectId,
        title: newTitle.trim(),
        status: 'todo',
      })
      setTasks((prev) => [...prev, task])
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
    const next = nextKanbanStatus(task.status)
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

  async function handleDeleteTask(task: Task) {
    if (!token) return
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return
    setError(null)
    try {
      await deleteTask(token, task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
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
        <Link to="/projects" className="mt-4 inline-block text-violet-400 hover:text-violet-300">
          ← К проектам
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-300">
            ← Все проекты
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-white">{project.name}</h1>
          {project.description ? (
            <p className="mt-2 max-w-2xl text-slate-400">{project.description}</p>
          ) : null}
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
          {saving ? 'Добавление…' : 'Добавить в «К выполнению»'}
        </button>
      </form>

      <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
        {columns.map((status) => (
          <section
            key={status}
            className="min-w-[min(100%,280px)] w-[min(100%,280px)] shrink-0 rounded-xl border border-slate-800 bg-slate-900/40"
          >
            <header className="border-b border-slate-800 px-3 py-2">
              <h2 className="text-sm font-medium text-slate-300">{labelForStatus(status)}</h2>
              <p className="text-xs text-slate-600">{status}</p>
            </header>
            <ul className="space-y-2 p-2">
              {(tasksByStatus.get(status) ?? []).map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-sm"
                >
                  <p className="font-medium text-slate-100">{task.title}</p>
                  {task.description ? (
                    <p className="mt-1 text-xs text-slate-500">{task.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void moveTask(task)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Дальше →
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTask(task)}
                      className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
