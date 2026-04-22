import { apiJson } from './client'

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
  position: number
  priority: number
  due_at: string | null
  assignee_id: string | null
  created_at: string
  updated_at: string
  pending?: boolean
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
    priority?: number
    due_at?: string | null
  },
): Promise<Task> {
  return apiJson<Task>('/tasks', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((t) => {
    if (!t) {
      const now = new Date().toISOString()
      return {
        id: `local-${crypto.randomUUID()}`,
        project_id: body.project_id,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'todo',
        position: body.position ?? 0,
        priority: body.priority ?? 0,
        due_at: body.due_at ?? null,
        assignee_id: null,
        created_at: now,
        updated_at: now,
        pending: true,
      }
    }
    return t
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
    priority: number
    due_at: string | null
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
