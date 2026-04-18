/**
 * Классический канбан: колонки по статусам, карточки в <ul>/<li>.
 */

import type { Task } from '../../api/tasks'
import { labelStatusColumn } from '../../constants/boardPresets'

export type TaskBoardKanbanListProps = {
  columns: string[]
  tasks: Task[]
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
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
  columns,
  tasks,
  onMoveNext,
  onDelete,
}: TaskBoardKanbanListProps) {
  const byCol = tasksByColumn(columns, tasks)

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
      {columns.map((status) => {
        const list = byCol.get(status) ?? []
        return (
          <section
            key={status}
            className="flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50"
          >
            <header className="border-b border-slate-800 px-3 py-2">
              <h2 className="text-sm font-medium text-slate-300">{labelStatusColumn(status)}</h2>
              <p className="text-[11px] text-slate-600">{list.length}</p>
            </header>
            <ul className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto p-2">
              {list.map((task) => (
                <li key={task.id}>
                  <article className="rounded-lg border border-slate-700 bg-slate-950/90 p-2.5 shadow-sm">
                    <p className="text-sm font-medium leading-snug text-slate-100">{task.title}</p>
                    {task.description ? (
                      <p className="mt-1 max-h-20 overflow-y-auto text-xs text-slate-500">{task.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
                        onClick={() => onMoveNext(task)}
                      >
                        Дальше →
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/30"
                        onClick={() => onDelete(task)}
                      >
                        Удалить
                      </button>
                    </div>
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
