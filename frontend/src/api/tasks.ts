import { apiJson } from './client'

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  position: number
  assignee_id: string | null
  created_at: string
  updated_at: string
}

export function listTasks(token: string, projectId: string): Promise<Task[]> {
  const q = new URLSearchParams({ project_id: projectId })
  return apiJson<Task[]>(`/tasks?${q}`, token)
}

export function createTask(
  token: string,
  body: {
    project_id: string
    title: string
    description?: string | null
    status?: string
    position?: number
  },
): Promise<Task> {
  return apiJson<Task>('/tasks', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateTask(
  token: string,
  taskId: string,
  body: Partial<{
    title: string
    description: string | null
    status: string
    position: number
    assignee_id: string | null
  }>,
): Promise<Task> {
  return apiJson<Task>(`/tasks/${taskId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteTask(token: string, taskId: string): Promise<void> {
  return apiJson<void>(`/tasks/${taskId}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}
