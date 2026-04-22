import { apiJson } from './client'
import type { Task } from './tasks'

export async function fetchNextFocusTask(token: string, projectId: string): Promise<Task | null> {
  const q = new URLSearchParams({ project_id: projectId })
  const task = await apiJson<Task>(`/focus/next?${q}`, token)
  return task ?? null
}

