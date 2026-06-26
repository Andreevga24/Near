import { apiJson } from './client'

export type TimeEntry = {
  id: string
  task_id: string
  user_id: string
  started_at: string
  stopped_at: string | null
  duration_seconds: number | null
  task_title?: string | null
}

export type TimeReport = {
  project_id: string | null
  total_seconds: number
  by_task: Array<{ task_id: string; task_title: string; total_seconds: number }>
  by_user: Array<{ user_id: string; user_email: string; total_seconds: number }>
  entries: TimeEntry[]
}

export function fetchActiveTimer(token: string): Promise<TimeEntry | null> {
  return apiJson<TimeEntry | null>('/time/active', token)
}

export function startTimer(token: string, taskId: string): Promise<TimeEntry> {
  return apiJson<TimeEntry>('/time/start', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId }),
  })
}

export function stopTimer(token: string): Promise<TimeEntry> {
  return apiJson<TimeEntry>('/time/stop', token, { method: 'POST' })
}

export function fetchTimeReport(token: string, projectId?: string, days = 30): Promise<TimeReport> {
  const q = new URLSearchParams({ days: String(days) })
  if (projectId) q.set('project_id', projectId)
  return apiJson<TimeReport>(`/time/report?${q}`, token)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s}с`
  return `${s}с`
}
