import { apiJson } from './client'
import type { Task } from './tasks'

export type FocusWeights = {
  due_weight: number
  priority_weight: number
  column_weight: number
  exclude_blocked: boolean
}

export async function fetchNextFocusTask(
  token: string,
  projectId: string,
  options?: FocusWeights & { skipIds?: string[] },
): Promise<Task | null> {
  const q = new URLSearchParams({ project_id: projectId })
  if (options) {
    q.set('due_weight', String(options.due_weight))
    q.set('priority_weight', String(options.priority_weight))
    q.set('column_weight', String(options.column_weight))
    q.set('exclude_blocked', String(options.exclude_blocked))
    if (options.skipIds?.length) q.set('skip', options.skipIds.join(','))
  }
  const task = await apiJson<Task>(`/focus/next?${q}`, token)
  return task ?? null
}
