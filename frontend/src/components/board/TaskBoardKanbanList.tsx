/**
 * Классический канбан: колонки по статусам, карточки в <ul>/<li>.
 */

import { useMemo } from 'react'

import type { Task } from '../../api/tasks'
import type { TaskLink } from '../../api/taskLinks'
import { hintForStatus, labelStatusColumn } from '../../constants/boardPresets'
import type { ProjectKind } from '../../constants/projectKinds'

export type TaskBoardKanbanListProps = {
  kind: ProjectKind
  hints?: Record<string, string> | null
  columns: string[]
  tasks: Task[]
  links: TaskLink[]
  readOnly?: boolean
  onMovePrev: (task: Task) => void
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenTask: (task: Task) => void
}

function tasksByColumn(columns: string[], tasks: Task[]): Map<string, Task[]> {
  const m = new Map<string, Task[]>()
  for (const c of columns) {
    m.set(c, [])
  }
  for (const t of tasks) {
    const arr = m.get(t.status) ?? []
    arr.push(t)
    m.set(t.status, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  }
  return m
}

export function TaskBoardKanbanList({
  kind,
  hints,
  columns,
  tasks,
  links,
  readOnly = false,
  onMovePrev,
  onMoveNext,
  onDelete,
  onOpenTask,
}: TaskBoardKanbanListProps) {
  const byCol = tasksByColumn(columns, tasks)
  const stats = useMemo(() => {
    const inBlocks = new Map<string, number>()
    const outBlocks = new Map<string, number>()
    const relates = new Map<string, number>()
    for (const l of links) {
      if (l.type === 'blocks') {
        outBlocks.set(l.from_task_id, (outBlocks.get(l.from_task_id) ?? 0) + 1)
        inBlocks.set(l.to_task_id, (inBlocks.get(l.to_task_id) ?? 0) + 1)
      } else if (l.type === 'relates') {
        // relates храним как направленные пары, поэтому достаточно считать исходящие для карточки.
        relates.set(l.from_task_id, (relates.get(l.from_task_id) ?? 0) + 1)
      }
    }
    return { inBlocks, outBlocks, relates }
  }, [links])

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
      {columns.map((status) => {
        const list = byCol.get(status) ?? []
        const hint = (hints && hints[status]) || hintForStatus(kind, status)
        return (
          <section
            key={status}
            className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50"
          >
            <header className="border-b border-slate-800 px-3 py-2">
              <h2 className="text-sm font-medium text-slate-300">{labelStatusColumn(status)}</h2>
              {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
              <p className="text-[11px] text-slate-600">{list.length}</p>
            </header>
            <ul className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto p-2">
              {list.map((task) => (
                <li key={task.id}>
                  <article className="rounded-lg border border-slate-700 bg-slate-950/90 p-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      {readOnly ? (
                        <p className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-slate-100">
                          {task.title}
                        </p>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            className="block min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium leading-snug text-slate-100 hover:text-white">
                              {task.title}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenTask(task)
                            }}
                            className="shrink-0 rounded border border-slate-700 bg-slate-900/40 p-1 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            aria-label="Открыть панель задачи"
                            title="Открыть панель"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                              <path
                                d="M9 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M13 9h6v6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M20 9l-9 9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(() => {
                        const a = stats.inBlocks.get(task.id) ?? 0
                        const b = stats.outBlocks.get(task.id) ?? 0
                        const r = stats.relates.get(task.id) ?? 0
                        return (
                          <>
                            {a > 0 ? (
                              <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                                ←{a}
                              </span>
                            ) : null}
                            {b > 0 ? (
                              <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                                →{b}
                              </span>
                            ) : null}
                            {r > 0 ? (
                              <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                                ↔{r}
                              </span>
                            ) : null}
                          </>
                        )
                      })()}
                    </div>
                    {task.description ? (
                      <p className="mt-1 max-h-20 overflow-y-auto text-xs text-slate-500">{task.description}</p>
                    ) : null}
                    {readOnly ? null : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                          onClick={() => onMovePrev(task)}
                          aria-label="Назад"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                          onClick={() => onMoveNext(task)}
                          aria-label="Вперёд"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/30"
                          onClick={() => onDelete(task)}
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
