/**
 * Доска проекта: задачи в виде нод (React Flow), колонки по типу проекта (kind).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { TimeTrackingPanel } from '../components/TimeTrackingPanel'
import {
  checklistSummary,
  createChecklistItem,
  deleteChecklistItem,
  listChecklistItems,
  reorderChecklistItems,
  updateChecklistItem,
  type ChecklistItem,
  type ChecklistSummary,
} from '../api/checklist'
import { createComment, deleteComment, listComments, type Comment } from '../api/comments'
import {
  applyStarterTasks,
  disableProjectShare,
  enableProjectShare,
  readProjectShare,
  updateProjectShare,
  type Project,
  type ProjectShare,
  listProjects,
} from '../api/projects'
import { getPendingTaskIds, subscribeOfflineQueue } from '../api/offlineQueue'
import { createTaskLink, deleteTaskLink, listTaskLinks, type TaskLink, type TaskLinkType } from '../api/taskLinks'
import { listTimeline, type TimelineEvent } from '../api/timeline'
import {
  addProjectMember,
  createProjectInvite,
  listProjectInvites,
  listProjectMembers,
  projectRoleLabel,
  removeProjectMember,
  revokeProjectInvite,
  updateProjectMemberRole,
  type ProjectInvite,
  type ProjectMember,
} from '../api/projectMembers'
import { fetchKindPreset } from '../api/presets'
import {
  closeTask,
  copyTaskToProject,
  createTask,
  deleteTask,
  duplicateTask,
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
import { useUiPreferences } from '../context/UiPreferencesContext'
import { useProjectBoardWebSocket } from '../hooks/useProjectBoardWebSocket'
import { emitProjectsChanged, emitTasksChanged } from '../nearEvents'

const BOARD_VIEW_STORAGE_KEY = 'near_project_board_view'
type BoardViewMode = 'kanban' | 'nodes'
type TaskListFilter = 'all' | 'mine' | 'overdue' | 'unassigned'

function readBoardViewMode(): BoardViewMode {
  if (typeof window === 'undefined') return 'kanban'
  return localStorage.getItem(BOARD_VIEW_STORAGE_KEY) === 'nodes' ? 'nodes' : 'kanban'
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function matchesTaskFilter(
  task: Task,
  filter: TaskListFilter,
  userId: string | undefined,
  nowMs: number,
): boolean {
  if (filter === 'all') return true
  if (filter === 'mine') return userId != null && task.assignee_id === userId
  if (filter === 'unassigned') return task.assignee_id == null
  if (filter === 'overdue') {
    if (!task.due_at || nowMs <= 0) return false
    return new Date(task.due_at).getTime() < nowMs
  }
  return true
}

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { token, user, logout } = useAuth()
  const { t } = useUiPreferences()
  const newTaskInputRef = useRef<HTMLInputElement>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [share, setShare] = useState<ProjectShare | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareExpiresDays, setShareExpiresDays] = useState<number | ''>(30)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => getPendingTaskIds())
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
  const [checklistSummaryMap, setChecklistSummaryMap] = useState<ChecklistSummary>({})
  const [taskFilter, setTaskFilter] = useState<TaskListFilter>('all')
  const [copyTargetProjectId, setCopyTargetProjectId] = useState('')
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState<'editor' | 'viewer'>('editor')
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [boardNowMs, setBoardNowMs] = useState(0)

  useEffect(() => {
    const refresh = () => setBoardNowMs(Date.now())
    refresh()
    const id = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(id)
  }, [])

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
      setAllProjects(plist)
      const p = plist.find((x) => x.id === projectId) ?? null
      setProject(p)
      if (p) {
        try {
          const mem = await listProjectMembers(token, projectId)
          setProjectMembers(mem.members)
        } catch {
          setProjectMembers([])
        }
        if (p.my_role === 'owner') {
          try {
            const inv = await listProjectInvites(token, projectId)
            setProjectInvites(inv)
          } catch {
            setProjectInvites([])
          }
        } else {
          setProjectInvites([])
        }
        setShareLoading(true)
        const [tlist, llist, summary] = await Promise.all([
          listTasks(token, projectId),
          listTaskLinks(token, projectId),
          checklistSummary(token, projectId),
        ])
        setTasks(tlist)
        setLinks(llist)
        setChecklistSummaryMap(summary)
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
        setChecklistSummaryMap({})
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

  useEffect(() => subscribeOfflineQueue(() => setPendingTaskIds(getPendingTaskIds())), [])

  const enableShare = useCallback(async () => {
    if (!token || !projectId) return
    const ok = window.confirm(
      'Публичная ссылка откроет read-only доступ к задачам проекта без входа в систему. ' +
        'Не включайте ссылку, если в задачах есть персональные или конфиденциальные данные. Продолжить?',
    )
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      const s = await enableProjectShare(token, projectId, {
        expires_in_days: shareExpiresDays === '' ? undefined : shareExpiresDays,
        hidden_columns: share?.hidden_columns,
      })
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
  }, [token, projectId, logout, copyToClipboard, publicUrlForShareId, shareExpiresDays, share])

  const toggleShareHiddenColumn = useCallback(
    async (status: string) => {
      if (!token || !projectId || !share?.enabled) return
      const current = share.hidden_columns ?? []
      const next = current.includes(status) ? current.filter((c) => c !== status) : [...current, status]
      try {
        const s = await updateProjectShare(token, projectId, { hidden_columns: next })
        setShare(s)
      } catch (e) {
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось обновить настройки ссылки')
      }
    },
    [token, projectId, share],
  )

  const applyStarter = useCallback(async () => {
    if (!token || !projectId) return
    setSaving(true)
    try {
      await applyStarterTasks(token, projectId)
      await loadBoard()
    } catch (e) {
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось применить шаблон')
    } finally {
      setSaving(false)
    }
  }, [token, projectId, loadBoard])

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
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить данные задачи')
      } finally {
        setCommentsLoading(false)
        setTimelineLoading(false)
        setChecklistLoading(false)
      }
    },
    [token, logout],
  )

  const closeTaskPanel = useCallback(() => {
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

  const fieldHistory = useMemo(
    () =>
      taskTimeline.filter(
        (ev) => ev.type === 'task_title_changed' || ev.type === 'task_description_changed',
      ),
    [taskTimeline],
  )

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

  const refreshChecklistSummary = useCallback(async () => {
    if (!token || !projectId) return
    const summary = await checklistSummary(token, projectId)
    setChecklistSummaryMap(summary)
  }, [token, projectId])

  const filteredTasks = useMemo(
    () => tasks.filter((t) => matchesTaskFilter(t, taskFilter, user?.id, boardNowMs)),
    [tasks, taskFilter, user?.id, boardNowMs],
  )

  const otherProjects = useMemo(
    () => allProjects.filter((p) => p.id !== projectId),
    [allProjects, projectId],
  )

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
  }, [token, currentTask, commentDraft, refreshComments, refreshTimeline, logout])

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
      await refreshChecklistSummary()
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
  }, [token, currentTask, newChecklistText, refreshChecklist, refreshChecklistSummary, refreshTimeline, logout])

  const toggleChecklistItem = useCallback(
    async (item: ChecklistItem, isDone: boolean) => {
      if (!token) return
      setSaving(true)
      setError(null)
      try {
        await updateChecklistItem(token, item.id, { is_done: isDone })
        await refreshChecklist()
        await refreshChecklistSummary()
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
    [token, refreshChecklist, refreshChecklistSummary, refreshTimeline, logout],
  )

  const removeChecklistItem = useCallback(
    async (item: ChecklistItem) => {
      if (!token) return
      setSaving(true)
      setError(null)
      try {
        await deleteChecklistItem(token, item.id)
        await refreshChecklist()
        await refreshChecklistSummary()
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
    [token, refreshChecklist, refreshChecklistSummary, refreshTimeline, logout],
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
        await refreshChecklistSummary()
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
    [token, currentTask, refreshChecklist, refreshChecklistSummary, refreshTimeline, logout],
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

  const onWsTaskDeleted = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (openTaskId === taskId) {
        closeTaskPanel()
      }
    },
    [openTaskId, closeTaskPanel],
  )

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

  const projectRole = project?.my_role ?? 'owner'
  const canEdit = projectRole !== 'viewer'
  const isOwner = projectRole === 'owner'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 'Escape' && openTaskId) {
        e.preventDefault()
        closeTaskPanel()
        return
      }
      if (e.key.toLowerCase() === 'n' && !typing && !e.ctrlKey && !e.metaKey && canEdit) {
        e.preventDefault()
        newTaskInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTaskId, closeTaskPanel, canEdit])

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
      if (!task.pending) {
        await openTask(task)
      }
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
      if (!updated) return
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
      if (!updated) return
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
        if (!updated) return
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

  async function patchCurrentTask(
    patch: Partial<{
      priority: number
      due_at: string | null
      assignee_id: string | null
    }>,
  ) {
    if (!token || !currentTask) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateTask(token, currentTask.id, patch)
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      emitTasksChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось обновить задачу')
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicateTask(task: Task) {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const created = await duplicateTask(token, task.id)
      setTasks((prev) => [...prev, created])
      await refreshChecklistSummary()
      emitTasksChanged()
      void openTask(created)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось дублировать задачу')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyTask(task: Task) {
    if (!token || !copyTargetProjectId) return
    setSaving(true)
    setError(null)
    try {
      await copyTaskToProject(token, task.id, copyTargetProjectId)
      emitTasksChanged()
      setError(null)
      window.alert('Задача скопирована в выбранный проект.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось скопировать задачу')
    } finally {
      setSaving(false)
    }
  }

  async function handleCloseTask(task: Task, completed: boolean) {
    if (!token) return
    const label = completed ? 'выполненной' : 'не выполненной'
    if (!window.confirm(`Закрыть задачу «${task.title}» как ${label}? Она уйдёт в архив.`)) return
    setError(null)
    setSaving(true)
    try {
      await closeTask(token, task.id, completed)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      if (openTaskId === task.id) {
        closeTaskPanel()
      }
      emitTasksChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось закрыть задачу')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!token) return
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return
    setError(null)
    try {
      await deleteTask(token, task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      if (openTaskId === task.id) {
        closeTaskPanel()
      }
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
        <Link to="/projects/carousel" className="near-link mt-4 inline-block">
          ← К проектам
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/projects/carousel" className="near-link-muted">
            ← Все проекты
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="near-h1">{project.name}</h1>
            <span className="near-badge">{labelProjectKind(projectKind)}</span>
            <span className="near-badge border-violet-800/60 bg-violet-950/40 text-violet-100">
              {projectRoleLabel(projectRole)}
            </span>
          </div>
          {!canEdit ? (
            <p className="mt-2 text-sm text-amber-200/80">Режим наблюдателя: изменения на доске недоступны.</p>
          ) : null}
          {project.description ? (
            <p className="mt-2 max-w-2xl text-slate-400">{project.description}</p>
          ) : null}
          {isOwner ? (
          <div className="near-card mt-3 max-w-2xl p-3">
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
                      className="near-btn-secondary border-emerald-900/60 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-950/40"
                      title="Скопировать ссылку"
                    >
                      Скопировать
                    </button>
                    <button
                      type="button"
                      onClick={() => void disableShare()}
                      disabled={saving}
                      className="near-btn-secondary px-3 py-2 text-xs disabled:opacity-50"
                    >
                      Выключить
                    </button>
                    <Link
                      to={`/public/${share.share_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="near-btn-secondary px-3 py-2 text-xs"
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
                    className="near-btn-secondary px-3 py-2 text-xs disabled:opacity-50"
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <label className="text-slate-500">
                Срок (дней):
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={shareExpiresDays}
                  onChange={(e) => setShareExpiresDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="ml-1 w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                />
              </label>
              {share?.expires_at ? (
                <span className="text-slate-500">до {new Date(share.expires_at).toLocaleDateString()}</span>
              ) : null}
            </div>
            {share?.enabled ? (
              <div className="mt-3">
                <p className="text-[11px] text-slate-500">Скрыть колонки в публичном виде:</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <label key={col} className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={(share.hidden_columns ?? []).includes(col)}
                        onChange={() => void toggleShareHiddenColumn(col)}
                      />
                      {labelStatusColumn(col)}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
          <div className="near-card mt-3 max-w-2xl p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Участники</p>
            <ul className="mt-2 space-y-2">
              {projectMembers.map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-slate-200">{m.email}</p>
                    <p className="text-xs text-slate-500">{projectRoleLabel(m.role)}</p>
                  </div>
                  {isOwner && !m.is_owner ? (
                    <div className="flex flex-wrap gap-1">
                      <select
                        value={m.role === 'viewer' ? 'viewer' : 'editor'}
                        onChange={(e) => {
                          const role = e.target.value as 'editor' | 'viewer'
                          void (async () => {
                            try {
                              await updateProjectMemberRole(token!, projectId!, m.user_id, role)
                              const mem = await listProjectMembers(token!, projectId!)
                              setProjectMembers(mem.members)
                            } catch (err) {
                              setError(err instanceof ApiError ? formatApiError(err.body) : 'Ошибка')
                            }
                          })()
                        }}
                        className="near-input py-1 text-xs"
                      >
                        <option value="editor">Редактор</option>
                        <option value="viewer">Наблюдатель</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Удалить ${m.email} из проекта?`)) return
                          void (async () => {
                            try {
                              await removeProjectMember(token!, projectId!, m.user_id)
                              const mem = await listProjectMembers(token!, projectId!)
                              setProjectMembers(mem.members)
                            } catch (err) {
                              setError(err instanceof ApiError ? formatApiError(err.body) : 'Ошибка')
                            }
                          })()
                        }}
                        className="near-btn-secondary px-2 py-1 text-xs"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {isOwner ? (
              <div className="mt-3 border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">Добавить по email (если уже зарегистрирован) или создать приглашение.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="near-input min-w-[200px] flex-1 py-1.5 text-sm"
                  />
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as 'editor' | 'viewer')}
                    className="near-input py-1.5 text-sm"
                  >
                    <option value="editor">Редактор</option>
                    <option value="viewer">Наблюдатель</option>
                  </select>
                  <button
                    type="button"
                    disabled={saving || !memberEmail.trim()}
                    onClick={() => {
                      void (async () => {
                        if (!token || !projectId) return
                        setSaving(true)
                        try {
                          await addProjectMember(token, projectId, {
                            email: memberEmail.trim(),
                            role: memberRole,
                          })
                          setMemberEmail('')
                          const mem = await listProjectMembers(token, projectId)
                          setProjectMembers(mem.members)
                        } catch (err) {
                          setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось добавить')
                        } finally {
                          setSaving(false)
                        }
                      })()
                    }}
                    className="near-btn-secondary text-xs disabled:opacity-50"
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    disabled={saving || !memberEmail.trim()}
                    onClick={() => {
                      void (async () => {
                        if (!token || !projectId) return
                        setSaving(true)
                        try {
                          const res = await createProjectInvite(token, projectId, {
                            email: memberEmail.trim(),
                            role: memberRole,
                          })
                          const url =
                            typeof window !== 'undefined'
                              ? `${window.location.origin}${res.accept_path}`
                              : res.accept_path
                          setLastInviteUrl(url)
                          await navigator.clipboard.writeText(url)
                          setMemberEmail('')
                          const inv = await listProjectInvites(token, projectId)
                          setProjectInvites(inv)
                        } catch (err) {
                          setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось создать приглашение')
                        } finally {
                          setSaving(false)
                        }
                      })()
                    }}
                    className="near-btn-secondary text-xs disabled:opacity-50"
                  >
                    Ссылка-приглашение
                  </button>
                </div>
                {lastInviteUrl ? (
                  <p className="mt-2 break-all text-xs text-emerald-300">Скопировано: {lastInviteUrl}</p>
                ) : null}
                {projectInvites.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {projectInvites.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {inv.email} · {projectRoleLabel(inv.role)} · до{' '}
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              if (!token || !projectId) return
                              await revokeProjectInvite(token, projectId, inv.id)
                              const list = await listProjectInvites(token, projectId)
                              setProjectInvites(list)
                            })()
                          }}
                          className="text-red-300 hover:text-red-200"
                        >
                          Отозвать
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
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
                  ? 'rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950'
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
                  ? 'rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }
            >
              Ноды
            </button>
          </div>
          <Link
            to={`/projects/${projectId}/archive`}
            className="near-btn-secondary mt-2 w-full px-3 py-2 text-xs"
          >
            Архив задач
          </Link>
          <Link
            to={`/projects/${projectId}/gantt`}
            className="near-btn-secondary mt-2 w-full px-3 py-2 text-xs"
          >
            Диаграмма Ганта
          </Link>
          <Link
            to={`/projects/${projectId}/focus`}
            className="near-btn-secondary mt-2 w-full px-3 py-2 text-xs"
          >
            Режим фокуса
          </Link>
        </div>
      </div>

      {error ? (
        <p className="near-alert-warn mt-4">{error}</p>
      ) : null}

      {canEdit ? (
      <form
        onSubmit={handleAddTask}
        className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1 text-sm">
          <span className="text-slate-500">{t('board.newTask')}</span>
          <input
            ref={newTaskInputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="near-input mt-1"
            placeholder="Что нужно сделать?"
            maxLength={500}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !newTitle.trim()}
          className="near-btn-primary"
        >
          {saving
            ? 'Добавление…'
            : `Добавить в «${labelStatusColumn(firstStatusForKind(projectKind))}»`}
        </button>
      </form>
      ) : null}
      {canEdit && tasks.length === 0 ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void applyStarter()}
          className="near-btn-secondary mt-3"
        >
          Применить стартовые задачи шаблона
        </button>
      ) : null}

      {canEdit ? (
        <p className="mt-2 text-xs text-slate-600">
          {t('board.hotkeyNew')} · {t('board.hotkeyEsc')}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Фильтр</span>
        {(
          [
            ['all', 'Все'],
            ['mine', 'Мои'],
            ['overdue', 'Просроченные'],
            ['unassigned', 'Без исполнителя'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTaskFilter(id)}
            className={
              taskFilter === id
                ? 'rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
            }
          >
            {label}
          </button>
        ))}
        {taskFilter !== 'all' ? (
          <span className="text-xs text-slate-500">
            Показано {filteredTasks.length} из {tasks.length}
          </span>
        ) : null}
      </div>

      <div className="mt-8">
        {boardView === 'kanban' ? (
          <TaskBoardKanbanList
            kind={projectKind}
            hints={columnHintsOverride}
            columns={columns}
            tasks={filteredTasks}
            links={links}
            readOnly={!canEdit}
            showCheckpoints={!!openTaskId}
            checklistSummary={checklistSummaryMap}
            currentUserId={user?.id}
            onMovePrev={(t) => void moveTaskBack(t)}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
            onOpenTask={(t) => void openTask(t)}
            pendingTaskIds={pendingTaskIds}
          />
        ) : (
          <TaskBoardGraph
            kind={projectKind}
            hints={columnHintsOverride}
            columns={columns}
            tasks={filteredTasks}
            links={links}
            readOnly={!canEdit}
            showCheckpoints={!!openTaskId}
            checklistSummary={checklistSummaryMap}
            currentUserId={user?.id}
            onMovePrev={(t) => void moveTaskBack(t)}
            onMoveNext={(t) => void moveTask(t)}
            onDelete={(t) => void handleDeleteTask(t)}
            onOpenTask={(t) => void openTask(t)}
            pendingTaskIds={pendingTaskIds}
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
            onClick={closeTaskPanel}
            aria-label="Свернуть панель"
          />
          <aside className="absolute inset-x-0 bottom-0 top-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-l border-slate-800 bg-slate-950 p-4 shadow-2xl sm:inset-x-auto sm:bottom-0 sm:top-0 sm:max-h-full sm:w-[min(92vw,520px)] sm:rounded-none">
            <div className="flex items-start justify-between gap-3 overflow-y-auto">
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
                onClick={closeTaskPanel}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                {t('board.collapsePanel')}
              </button>
            </div>

            {currentTask && canEdit ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Параметры</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-400">
                    Приоритет (0–10)
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={currentTask.priority}
                      onChange={(e) => {
                        const v = Math.min(10, Math.max(0, Number(e.target.value) || 0))
                        setTasks((prev) =>
                          prev.map((t) => (t.id === currentTask.id ? { ...t, priority: v } : t)),
                        )
                      }}
                      onBlur={() => void patchCurrentTask({ priority: currentTask.priority })}
                      disabled={saving}
                      className="near-input mt-1 w-full py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Дедлайн
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(currentTask.due_at)}
                      onChange={(e) => {
                        const iso = fromDatetimeLocalValue(e.target.value)
                        setTasks((prev) =>
                          prev.map((t) => (t.id === currentTask.id ? { ...t, due_at: iso } : t)),
                        )
                      }}
                      onBlur={() => void patchCurrentTask({ due_at: currentTask.due_at })}
                      disabled={saving}
                      className="near-input mt-1 w-full py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs text-slate-400 sm:col-span-2">
                    Исполнитель
                    <select
                      value={currentTask.assignee_id ?? ''}
                      onChange={(e) => {
                        const assignee_id = e.target.value || null
                        void patchCurrentTask({ assignee_id })
                      }}
                      disabled={saving}
                      className="near-input mt-1 w-full py-1.5 text-sm"
                    >
                      <option value="">Не назначен</option>
                      {projectMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_id === user?.id ? `Я (${m.email})` : m.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {currentTask ? (
                  <TimeTrackingPanel token={token!} taskId={currentTask.id} canEdit={canEdit} />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDuplicateTask(currentTask)}
                    disabled={saving}
                    className="near-btn-secondary text-xs disabled:opacity-50"
                  >
                    Дублировать
                  </button>
                  {otherProjects.length > 0 ? (
                    <>
                      <select
                        value={copyTargetProjectId}
                        onChange={(e) => setCopyTargetProjectId(e.target.value)}
                        className="near-input max-w-[200px] py-1.5 text-xs"
                      >
                        <option value="">Проект для копии…</option>
                        {otherProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleCopyTask(currentTask)}
                        disabled={saving || !copyTargetProjectId}
                        className="near-btn-secondary text-xs disabled:opacity-50"
                      >
                        Копировать в проект
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {currentTask && canEdit ? (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Закрыть задачу
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Задача уйдёт в архив на 30 дней (срок настраивается на сервере).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCloseTask(currentTask, true)}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600/90 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Выполнена
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCloseTask(currentTask, false)}
                    disabled={saving}
                    className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-950/50 disabled:opacity-50"
                  >
                    Не выполнена
                  </button>
                  <Link
                    to={`/projects/${projectId}/archive`}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Архив →
                  </Link>
                </div>
              </div>
            ) : null}

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
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t('board.fieldHistory')}</p>
                <div className="mt-2 max-h-[20vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-2">
                  {fieldHistory.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-600">—</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {fieldHistory.map((ev) => {
                        const data = ev.data as { from?: string | null; to?: string | null }
                        const label =
                          ev.type === 'task_title_changed' ? 'Название' : 'Описание'
                        const preview = (s: string | null | undefined, max = 120) => {
                          if (!s) return '—'
                          return s.length > max ? `${s.slice(0, max)}…` : s
                        }
                        return (
                          <li key={ev.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-sm">
                            <p className="text-xs text-slate-500">
                              {label} · {ev.actor_email ?? '—'} · {new Date(ev.created_at).toLocaleString()}
                            </p>
                            <p className="mt-1 text-slate-400 line-through">{preview(data.from)}</p>
                            <p className="mt-0.5 text-slate-200">{preview(data.to)}</p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
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
                                        : ev.type === 'task_title_changed'
                                          ? `Название: ${(ev.data as { from?: string }).from ?? '?'} → ${(ev.data as { to?: string }).to ?? '?'}`
                                          : ev.type === 'task_description_changed'
                                            ? 'Изменено описание'
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
