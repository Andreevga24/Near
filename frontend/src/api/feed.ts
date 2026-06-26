import { apiJson } from './client'

export type FeedItem = {
  id: string
  type: string
  created_at: string
  project_id: string
  project_name: string
  task_id: string | null
  task_title: string | null
  actor_id: string | null
  actor_email: string | null
  summary: string
  data: Record<string, unknown>
  href: string
}

export function listFeed(token: string, projectId?: string, limit = 100): Promise<{ items: FeedItem[] }> {
  const q = new URLSearchParams({ limit: String(limit) })
  if (projectId) q.set('project_id', projectId)
  return apiJson<{ items: FeedItem[] }>(`/feed?${q}`, token)
}

export function feedTypeLabel(type: string): string {
  switch (type) {
    case 'task_created':
      return 'Создана задача'
    case 'task_closed':
      return 'Задача закрыта'
    case 'task_restored':
      return 'Задача восстановлена'
    case 'task_status_changed':
      return 'Смена статуса'
    case 'task_assignee_changed':
      return 'Назначен исполнитель'
    case 'comment_created':
      return 'Комментарий'
    case 'due_soon':
      return 'Скоро дедлайн'
    default:
      return type
  }
}
