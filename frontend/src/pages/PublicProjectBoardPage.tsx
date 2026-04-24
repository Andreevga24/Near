/**
 * Публичная read-only доска проекта по shareId.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { fetchPublicBoard } from '../api/public'
import type { Task } from '../api/tasks'
import type { TaskLink } from '../api/taskLinks'
import { TaskBoardGraph } from '../components/board/TaskBoardGraph'
import { TaskBoardKanbanList } from '../components/board/TaskBoardKanbanList'
import { orderedBoardColumns } from '../constants/boardPresets'
import { DEFAULT_PROJECT_KIND, isProjectKind, labelProjectKind, type ProjectKind } from '../constants/projectKinds'

const BOARD_VIEW_STORAGE_KEY = 'near_public_board_view'
type BoardViewMode = 'kanban' | 'nodes'

function readBoardViewMode(): BoardViewMode {
  if (typeof window === 'undefined') return 'kanban'
  return localStorage.getItem(BOARD_VIEW_STORAGE_KEY) === 'nodes' ? 'nodes' : 'kanban'
}

export function PublicProjectBoardPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boardView, setBoardView] = useState<BoardViewMode>(readBoardViewMode)

  const [projectName, setProjectName] = useState<string>('')
  const [projectDescription, setProjectDescription] = useState<string | null>(null)
  const [projectKind, setProjectKind] = useState<ProjectKind>(DEFAULT_PROJECT_KIND)
  const [tasks, setTasks] = useState<Task[]>([])
  const [links, setLinks] = useState<TaskLink[]>([])

  const setBoardViewPersist = useCallback((mode: BoardViewMode) => {
    setBoardView(mode)
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, mode)
  }, [])

  useEffect(() => {
    if (!shareId) return
    setError(null)
    setLoading(true)
    void (async () => {
      try {
        const data = await fetchPublicBoard(shareId)
        setProjectName(data.project.name)
        setProjectDescription(data.project.description)
        setProjectKind(isProjectKind(data.project.kind) ? (data.project.kind as ProjectKind) : DEFAULT_PROJECT_KIND)
        setTasks(data.tasks as Task[])
        setLinks(data.links as TaskLink[])
      } catch (e) {
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось открыть публичную доску')
      } finally {
        setLoading(false)
      }
    })()
  }, [shareId])

  const columns = useMemo(() => orderedBoardColumns(projectKind, tasks), [projectKind, tasks])

  if (!shareId) {
    return <p className="text-slate-400">Не указана публичная ссылка.</p>
  }

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
  }

  if (error) {
    return (
      <div>
        <p className="near-alert-warn">{error}</p>
        <p className="mt-4 text-sm text-slate-500">
          Если вы владелец, включите публичный доступ в карточке проекта.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/" className="near-link-muted">
            ← На главную
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="near-h1">{projectName || 'Публичная доска'}</h1>
            <span className="near-badge">{labelProjectKind(projectKind)}</span>
            <span className="near-badge border-emerald-900/50 bg-emerald-950/30 text-emerald-200">Read-only</span>
          </div>
          {projectDescription ? <p className="mt-2 max-w-2xl text-slate-400">{projectDescription}</p> : null}
          <p className="mt-3 max-w-2xl text-xs text-slate-600">
            Это публичный просмотр. Изменения и комментарии доступны только владельцу проекта.
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
        </div>
      </div>

      <div className="mt-8">
        {boardView === 'kanban' ? (
          <TaskBoardKanbanList
            kind={projectKind}
            columns={columns}
            tasks={tasks}
            links={links}
            readOnly
            onMovePrev={() => {}}
            onMoveNext={() => {}}
            onDelete={() => {}}
            onOpenTask={() => {}}
          />
        ) : (
          <TaskBoardGraph
            kind={projectKind}
            columns={columns}
            tasks={tasks}
            links={links}
            readOnly
            onMovePrev={() => {}}
            onMoveNext={() => {}}
            onDelete={() => {}}
            onOpenTask={() => {}}
            onTaskStatusChange={async () => {}}
            onCreateLink={async () => {}}
            onDeleteLink={async () => {}}
          />
        )}
      </div>
    </div>
  )
}

