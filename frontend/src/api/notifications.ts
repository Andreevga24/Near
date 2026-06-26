import { apiJson } from './client'

export type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  project_id: string | null
  task_id: string | null
  read_at: string | null
  created_at: string
}

export const NOTIFICATIONS_CHANGED_EVENT = 'near_notifications_changed'

export function listNotifications(token: string, limit = 50): Promise<{ items: Notification[]; unread_count: number }> {
  const q = new URLSearchParams({ limit: String(limit) })
  return apiJson<{ items: Notification[]; unread_count: number }>(`/notifications?${q}`, token)
}

export function unreadNotificationCount(token: string): Promise<{ count: number }> {
  return apiJson<{ count: number }>('/notifications/unread-count', token)
}

export function markNotificationsRead(token: string, ids: string[]): Promise<void> {
  return apiJson<void>('/notifications/mark-read', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    parseJson: false,
  })
}

export function markAllNotificationsRead(token: string): Promise<void> {
  return apiJson<void>('/notifications/mark-all-read', token, {
    method: 'POST',
    parseJson: false,
  })
}

export function emitNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}
