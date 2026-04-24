/**
 * Доска проекта: задачи в виде нод (React Flow), колонки по типу проекта (kind).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import {
  createChecklistItem,
  deleteChecklistItem,
  listChecklistItems,
  reorderChecklistItems,
  updateChecklistItem,
  type ChecklistItem,
} from '../api/checklist'
import { createComment, deleteComment, listComments, type Comment } from '../api/comments'
import {
  disableProjectShare,
  enableProjectShare,
  readProjectShare,
  type Project,
  type ProjectShare,
  listProjects,
} from '../api/projects'
import { createTaskLink, deleteTaskLink, listTaskLinks, type TaskLink, type TaskLinkType } from '../api/taskLinks'
import { listTimeline, type TimelineEvent } from '../api/timeline'
import { fetchKindPreset } from '../api/presets'
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
  prevKanbanColumn,
} from '../constants/boardPresets'
import { DEFAULT_PROJECT_KIND, isProjectKind, labelProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'
import { useProjectBoardWebSocket } from '../hooks/useProjectBoardWebSocket'
import { emitProjectsChanged, emitTasksChanged } from '../nearEvents'

const BOARD_VIEW_STORAGE_KEY = 'near_project_board_view'
type BoardViewMode = 'kanban' | 'nodes'

function readBoardViewMode(): BoardViewMode {
  if (typeof window === 'undefined') return 'kanban'
  return localStorage.getItem(BOARD_VIEW_STORAGE_KEY) === 'nodes' ? 'nodes' : 'kanban'
}

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { token, logout } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [share, setShare] = useState<ProjectShare | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [links, setLinks] = useState<TaskLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [boardView, setBoardView] = useState<BoardViewMode>(readBoardViewMode)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [taskComments, setTaskComments] = useState<Comment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [taskTimeline, setTaskTimeline] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [newChecklistText, setNewChecklistText] = useState('')
  const [dragChecklistId, setDragChecklistId] = useState<string | null>(null)
  const [columnHintsOverride, setColumnHintsOverride] = useState<Record<string, string> | null>(null)

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
        setShareLoading(true)
        const [tlist, llist] = await Promise.all([
          listTasks(token, projectId),
          listTaskLinks(token, projectId),
        ])
        setTasks(tlist)
        setLinks(llist)
        try {
          const s = await readProjectShare(token, projectId)
          setShare(s)
        } catch {
          setShare(null)
        } finally {
          setShareLoading(false)
        }
        if (p.kind) {
          try {
            const preset = await fetchKindPreset(token, p.kind)
            setColumnHintsOverride(preset.column_hints ?? null)
          } catch {
            setColumnHintsOverride(null)
          }
        } else {
          setColumnHintsOverride(null)
        }
      } else {
        setTasks([])
        setLinks([])
        setColumnHintsOverride(null)
        setShare(null)
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

  const publicUrlForShareId = useCallback((sid: string) => {
    if (typeof window === 'undefined') return `/public/${sid}`
    return `${window.location.origin}/public/${sid}`
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [])

  const enableShare = useCallback(async () => {
    if (!token || !projectId) return
    setSaving(true)
    setError(null)
    try {
      const s = await enableProjectShare(token, projectId)
      setShare(s)
      if (s.share_id) {
        await copyToClipboard(publicUrlForShareId(s.share_id))
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось включить публичную ссылку')
    } finally {
      setSaving(false)
    }
  }, [token, projectId, logout, copyToClipboard, publicUrlForShareId])

  const disableShare = useCallback(async () => {
    if (!token || !projectId) return
    setSaving(true)
    setError(null)
    try {
      const s = await disableProjectShare(token, projectId)
      setShare(s)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось выключить публичную ссылку')
    } finally {
      setSaving(false)
    }
  }, [token, projectId, logout])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (!token) return
    const onOnline = () => {
      // after offline queue drained, refresh board data
      void loadBoard()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [token, loadBoard])

  const reloadTasksOnly = useCallback(async () => {
    if (!token || !projectId) return
    try {
      const tlist = await listTasks(token, projectId)
      setTasks(tlist)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      throw e
    }
  }, [token, projectId, logout])

  const reloadLinksOnly = useCallback(async () => {
    if (!token || !projectId) return
    try {
      const llist = await listTaskLinks(token, projectId)
      setLinks(llist)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      throw e
    }
  }, [token, projectId, logout])

  const openTask = useCallback(
    async (task: Task) => {
      if (!token) return
      setOpenTaskId(task.id)
      setCommentDraft('')
      setCommentsLoading(true)
      setTimelineLoading(true)
      setChecklistLoading(true)
      try {
        const [clist, tlist, checklist] = await Promise.all([
          listComments(token, task.id),
          listTimeline(token, task.id),
          listChecklistItems(token, task.id),
        ])
        setTaskComments(clist)
        setTaskTimeline(tlist)
        setChecklistItems(checklist)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить комментарии')
      } finally {
        setCommentsLoading(false)
        setTimelineLoading(false)
        setChecklistLoading(false)
      }
    },
    [token, logout],
  )

  const closeTask = useCallback(() => {
    setOpenTaskId(null)
    setTaskComments([])
    setCommentDraft('')
    setCommentsLoading(false)
    setTaskTimeline([])
    setTimelineLoading(false)
    setChecklistItems([])
    setChecklistLoading(false)
    setNewChecklistText('')
  }, [])

  const currentTask = useMemo(() => {
    if (!openTaskId) return null
    return tasks.find((t) => t.id === openTaskId) ?? null
  }, [openTaskId, tasks])

  const refreshComments = useCallback(async () => {
    if (!token || !openTaskId) return
    const clist = await listComments(token, openTaskId)
    setTaskComments(clist)
  }, [token, openTaskId])

  const refreshTimeline = useCallback(async () => {
    if (!token || !openTaskId) return
    const tlist = await listTimeline(token, openTaskId)
    setTaskTimeline(tlist)
  }, [token, openTaskId])

  const refreshChecklist = useCallback(async () => {
    if (!token || !openTaskId) return
    const items = await listChecklistItems(token, openTaskId)
    setChecklistItems(items)
  }, [token, openTaskId])

  const submitComment = useCallback(async () => {
    if (!token || !currentTask) return
    const body = commentDraft.trim()
    if (!body) return
    setSaving(true)
    setError(null)
    try {
      await createComment(token, { task_id: currentTask.id, body })
      setCommentDraft('')
      await refreshComments()
      await refreshTimeline()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось отправить комментарий')
    } finally {
      setSaving(false)
    }
  }, [token, currentTask, commentDraft, refreshComments, logout])

  const addChecklistItem = useCallback(async () => {
    if (!token || !currentTask) return
    const text = newChecklistText.trim()
    if (!text) return
    setSaving(true)
    setError(null)
    try {
      await createChecklistItem(token, { task_id: currentTask.id, text })
      setNewChecklistText('')
      await refreshChecklist()
      await refreshTimeline()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось добавить пункт чеклиста')
    } finally {
      setSaving(false)
    }
  }, [token, currentTask, newChecklistText, refreshChecklist, refreshTimeline, logout])

  const toggleChecklistItem = useCallback(
    async (item: ChecklistItem, isDone: boolean) => {
      if (!token) return
      setSaving(true)
      setError(null)
      try {
        await updateChecklistItem(token, item.id, { is_done: isDone })
        await refreshChecklist()
        await refreshTimeline()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось обновить чеклист')
      } finally {
        setSaving(false)
      }
    },
    [token, refreshChecklist, refreshTimeline, logout],
  )

  const removeChecklistItem = useCallback(
    async (item: ChecklistItem) => {
      if (!token) return
      setSaving(true)
      setError(null)
      try {
        await deleteChecklistItem(token, item.id)
        await refreshChecklist()
        await refreshTimeline()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось удалить пункт чеклиста')
      } finally {
        setSaving(false)
      }
    },
    [token, refreshChecklist, refreshTimeline, logout],
  )

  const reorderChecklist = useCallback(
    async (ordered: ChecklistItem[]) => {
      if (!token || !currentTask) return
      setSaving(true)
      setError(null)
      try {
        await reorderChecklistItems(token, {
          task_id: currentTask.id,
          ordered_item_ids: ordered.map((x) => x.id),
        })
        await refreshChecklist()
        await refreshTimeline()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось изменить порядок чеклиста')
      } finally {
        setSaving(false)
      }
    },
    [token, currentTask, refreshChecklist, refreshTimeline, logout],
  )

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!token) return
      setSaving(true)
      setError(null)
      try {
        await deleteComment(token, commentId)
        await refreshComments()
        await refreshTimeline()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось удалить комментарий')
      } finally {
        setSaving(false)
      }
    },
    [token, refreshComments, refreshTimeline, logout],
  )

  const onWsTaskDeleted = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  const onWsProjectDeleted = useCallback(() => {
    emitProjectsChanged()
    navigate('/projects/carousel', { replace: true })
  }, [navigate])

  useProjectBoardWebSocket({
    enabled: Boolean(token && projectId && project),
    projectId: projectId ?? '',
    token: token ?? '',
    onReloadTasks: reloadTasksOnly,
    onReloadLinks: reloadLinksOnly,
    onTaskDeleted: onWsTaskDeleted,
    onProjectDeleted: onWsProjectDeleted,
  })

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

  async function moveTaskBack(task: Task) {
    if (!token) return
    const prev = prevKanbanColumn(task.status, columns)
    setError(null)
    try {
      const updated = await updateTask(token, task.id, { status: prev })
      setTasks((p) => p.map((t) => (t.id === updated.id ? updated : t)))
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

  const onCreateLink = useCallback(
    async (fromTaskId: string, toTaskId: string, type: TaskLinkType) => {
      if (!token || !projectId) throw new Error('Нет сессии')
      setError(null)
      try {
        await createTaskLink(token, {
          project_id: projectId,
          from_task_id: fromTaskId,
          to_task_id: toTaskId,
          type,
        })
        await reloadLinksOnly()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          throw err
        }
        setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось создать связь')
        throw err
      }
    },
    [token, projectId, reloadLinksOnly, logout],
  )

  const onDeleteLink = useCallback(
    async (fromTaskId: string, toTaskId: string, type: TaskLinkType) => {
      if (!token || !projectId) throw new Error('Нет сессии')
      setError(null)
      try {
        await deleteTaskLink(token, {
          project_id: projectId,
          from_task_id: fromTaskId,
          to_task_id: toTaskId,
          type,
        })
        await reloadLinksOnly()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          throw err
        }
        setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось удалить связь')
        throw err
      }
    },
    [token, projectId, reloadLinksOnly, logout],
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
          <div className="mt-3 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Публичная ссылка</p>
                {shareLoading ? (
                  <p className="mt-1 text-sm text-slate-500">Загрузка…</p>
                ) : share?.enabled && share.share_id ? (
                  <p className="mt-1 break-all text-sm text-slate-300">{publicUrlForShareId(share.share_id)}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">Выключена (доступ только по логину).</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {share?.enabled && share.share_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(publicUrlForShareId(share.share_id!))}
                      className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-950/40"
                      title="Скопировать ссылку"
                    >
                      Скопировать
                    </button>
                    <button
                      type="button"
                      onClick={() => void disableShare()}
                      disabled={saving}
                      className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Выключить
                    </button>
                    <Link
                      to={`/public/${share.share_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                      title="Открыть в новой вкладке"
                    >
                      Открыть
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void enableShare()}
                    disabled={saving}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    title="Включить и скопировать ссылку"
                  >
                    Включить
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Публичная доска работает в режиме только чтение. Вы можете выключить доступ в любой момент.
            </p>
          </div>
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
          <Link
            to={`/projects/${projectId}/focus`}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Режим фокуса
          </Link>
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
            kind={projectKind}
            hints={columnHintsOverride}
            columns={columns}
            tasks={tasks}
            links={links}
            showCheckpoints={!!openTaskId}
            onMovePrev={(t) => void moveTaskBack(t)}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
            onOpenTask={(t) => void openTask(t)}
          />
        ) : (
          <TaskBoardGraph
            kind={projectKind}
            hints={columnHintsOverride}
            columns={columns}
            tasks={tasks}
            links={links}
            showCheckpoints={!!openTaskId}
            onMovePrev={(t) => void moveTaskBack(t)}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
            onOpenTask={(t) => void openTask(t)}
            onTaskStatusChange={onTaskStatusChange}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
          />
        )}
      </div>

      {openTaskId ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={closeTask}
            aria-label="Закрыть"
          />
          <aside className="absolute right-0 top-0 h-full w-[min(92vw,520px)] border-l border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Задача</p>
                <h2 className="mt-1 break-words text-lg font-semibold text-white">
                  {currentTask?.title ?? '…'}
                </h2>
                {currentTask?.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{currentTask.description}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Без описания.</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeTask}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Чеклист</p>
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/30 p-2">
                {checklistLoading ? (
                  <p className="px-2 py-3 text-sm text-slate-500">Загрузка…</p>
                ) : checklistItems.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-600">Пунктов пока нет.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {checklistItems.map((it) => (
                      <li
                        key={it.id}
                        draggable
                        onDragStart={() => setDragChecklistId(it.id)}
                        onDragEnd={() => setDragChecklistId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!dragChecklistId || dragChecklistId === it.id) return
                          const fromIdx = checklistItems.findIndex((x) => x.id === dragChecklistId)
                          const toIdx = checklistItems.findIndex((x) => x.id === it.id)
                          if (fromIdx === -1 || toIdx === -1) return
                          const next = [...checklistItems]
                          const [moved] = next.splice(fromIdx, 1)
                          if (!moved) return
                          next.splice(toIdx, 0, moved)
                          setChecklistItems(next)
                          void reorderChecklist(next)
                        }}
                        className={
                          'flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 ' +
                          (dragChecklistId === it.id ? 'opacity-60' : '')
                        }
                        title="Перетащите, чтобы изменить порядок"
                      >
                        <label className="flex min-w-0 flex-1 items-start gap-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={it.is_done}
                            onChange={(e) => void toggleChecklistItem(it, e.target.checked)}
                            disabled={saving}
                            className="mt-0.5"
                          />
                          <span className={it.is_done ? 'text-slate-500 line-through' : ''}>{it.text}</span>
                        </label>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/30"
                          onClick={() => void removeChecklistItem(it)}
                          disabled={saving}
                        >
                          Удалить
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
                    placeholder="Добавить пункт…"
                    maxLength={5000}
                  />
                  <button
                    type="button"
                    onClick={() => void addChecklistItem()}
                    disabled={saving || !newChecklistText.trim()}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void refreshChecklist()}
                    disabled={saving || !openTaskId}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Обновить чеклист
                  </button>
                </div>
              </div>

              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Комментарии</p>
              <div className="mt-2 max-h-[42vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-2">
                {commentsLoading ? (
                  <p className="px-2 py-3 text-sm text-slate-500">Загрузка…</p>
                ) : taskComments.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-600">Комментариев пока нет.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {taskComments.map((c) => (
                      <li key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            {c.author_email ?? 'Пользователь'} · {new Date(c.created_at).toLocaleString()}
                            {c.mentions.length ? (
                              <span className="ml-2 text-slate-400">mentions: {c.mentions.join(', ')}</span>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/30"
                            onClick={() => void removeComment(c.id)}
                            disabled={saving}
                          >
                            Удалить
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Таймлайн</p>
                <div className="mt-2 max-h-[28vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-2">
                  {timelineLoading ? (
                    <p className="px-2 py-3 text-sm text-slate-500">Загрузка…</p>
                  ) : taskTimeline.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-600">Событий пока нет.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {taskTimeline.map((ev) => (
                        <li key={`${ev.type}:${ev.id}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                          <p className="text-xs text-slate-500">
                            {ev.actor_email ?? 'Система'} · {new Date(ev.created_at).toLocaleString()}
                          </p>
                          <p className="mt-1 text-sm text-slate-200">
                            {ev.type === 'task_created'
                              ? `Создана задача`
                              : ev.type === 'task_status_changed'
                                ? `Статус: ${(ev.data as { from?: string }).from ?? '?'} → ${(ev.data as { to?: string }).to ?? '?'}`
                                : ev.type === 'link_created'
                                  ? `Добавлена связь ${(ev.data as { link_type?: string }).link_type ?? ''}`
                                  : ev.type === 'link_deleted'
                                    ? `Удалена связь ${(ev.data as { link_type?: string }).link_type ?? ''}`
                                    : ev.type === 'comment_deleted'
                                      ? `Удалён комментарий`
                                      : ev.type === 'comment_created'
                                        ? `Комментарий`
                                        : ev.type}
                          </p>
                          {ev.type === 'comment_created' && typeof (ev.data as { body?: unknown }).body === 'string' ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                              {(ev.data as { body: string }).body}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void refreshTimeline()}
                    disabled={saving || !openTaskId}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Обновить таймлайн
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-sm">
                  <span className="text-slate-500">Новый комментарий</span>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    className="mt-1 h-24 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
                    placeholder="Напишите сообщение. Можно упоминать: @user@example.com"
                    maxLength={50_000}
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitComment()}
                    disabled={saving || !commentDraft.trim()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    Отправить
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshComments()}
                    disabled={saving || !openTaskId}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Обновить
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
