import { useEffect, useState } from 'react'

import type { ChecklistSummary } from '../../api/checklist'
import type { Task } from '../../api/tasks'

function formatDueShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function TaskMetaBadges({
  task,
  checklistSummary,
  currentUserId,
}: {
  task: Task
  checklistSummary?: ChecklistSummary
  currentUserId?: string | null
}) {
  const [nowMs, setNowMs] = useState(0)
  const cl = checklistSummary?.[task.id]

  useEffect(() => {
    const refresh = () => setNowMs(Date.now())
    refresh()
    const id = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const overdue =
    nowMs > 0 && task.due_at != null && new Date(task.due_at).getTime() < nowMs
  const hasMeta =
    task.priority > 0 ||
    task.due_at != null ||
    task.assignee_id != null ||
    (cl != null && cl.total > 0)

  if (!hasMeta) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {task.priority > 0 ? (
        <span className="rounded border border-violet-800/60 bg-violet-950/40 px-1.5 py-0.5 text-[10px] text-violet-200">
          P{task.priority}
        </span>
      ) : null}
      {task.due_at ? (
        <span
          className={
            overdue
              ? 'rounded border border-red-800/60 bg-red-950/40 px-1.5 py-0.5 text-[10px] text-red-200'
              : 'rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400'
          }
        >
          {formatDueShort(task.due_at)}
        </span>
      ) : null}
      {cl && cl.total > 0 ? (
        <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
          ✓ {cl.done}/{cl.total}
        </span>
      ) : null}
      {task.assignee_id ? (
        <span
          className="rounded border border-emerald-900/50 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] text-emerald-200"
          title="Исполнитель назначен"
        >
          {currentUserId && task.assignee_id === currentUserId ? 'Я' : '●'}
        </span>
      ) : null}
    </div>
  )
}
