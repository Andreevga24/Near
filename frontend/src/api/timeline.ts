import { apiJson } from './client'

export type TimelineEvent = {
  id: string
  task_id: string
  type: string
  created_at: string
  actor_id: string | null
  actor_email: string | null
  data: Record<string, unknown>
}

export function listTimeline(token: string, taskId: string): Promise<TimelineEvent[]> {
  const q = new URLSearchParams({ task_id: taskId })
  return apiJson<TimelineEvent[]>(`/timeline?${q}`, token)
}

