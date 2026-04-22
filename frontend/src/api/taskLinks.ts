import { apiJson } from './client'

export type TaskLinkType = 'blocks' | 'relates'

export type TaskLink = {
  id: string
  project_id: string
  from_task_id: string
  to_task_id: string
  type: TaskLinkType
  created_at: string
}

export function listTaskLinks(token: string, projectId: string): Promise<TaskLink[]> {
  const q = new URLSearchParams({ project_id: projectId })
  return apiJson<TaskLink[]>(`/task-links?${q}`, token)
}

export function createTaskLink(
  token: string,
  body: {
    project_id: string
    from_task_id: string
    to_task_id: string
    type: TaskLinkType
  },
): Promise<TaskLink> {
  return apiJson<TaskLink>('/task-links', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteTaskLink(
  token: string,
  params: {
    project_id: string
    from_task_id: string
    to_task_id: string
    type: TaskLinkType
  },
): Promise<void> {
  const q = new URLSearchParams(params)
  return apiJson<void>(`/task-links?${q}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}

