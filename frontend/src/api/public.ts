import { API_BASE_URL } from '../config'

import { ApiError } from './auth'

export type PublicProject = {
  id: string
  name: string
  description: string | null
  kind: string
  created_at: string
  updated_at: string
}

export type PublicBoardResponse = {
  project: PublicProject
  tasks: Array<{
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
  }>
  links: Array<{
    id: string
    project_id: string
    from_task_id: string
    to_task_id: string
    type: string
    created_at: string
  }>
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { detail: res.statusText }
  }
}

export async function fetchPublicBoard(shareId: string): Promise<PublicBoardResponse> {
  const res = await fetch(`${API_BASE_URL}/public/${encodeURIComponent(shareId)}`)
  if (!res.ok) {
    throw new ApiError(res.status, await safeJson(res))
  }
  return (await res.json()) as PublicBoardResponse
}

