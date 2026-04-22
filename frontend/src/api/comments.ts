import { apiJson } from './client'

export type Comment = {
  id: string
  task_id: string
  author_id: string | null
  author_email: string | null
  body: string
  created_at: string
  mentions: string[]
}

export function listComments(token: string, taskId: string): Promise<Comment[]> {
  const q = new URLSearchParams({ task_id: taskId })
  return apiJson<Comment[]>(`/comments?${q}`, token)
}

export function createComment(
  token: string,
  body: {
    task_id: string
    body: string
  },
): Promise<Comment> {
  return apiJson<Comment>('/comments', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteComment(token: string, commentId: string): Promise<void> {
  return apiJson<void>(`/comments/${commentId}`, token, { method: 'DELETE', parseJson: false })
}

