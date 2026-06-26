import type { ProjectKind } from '../constants/projectKinds'
import type { ProjectRole } from './projectMembers'
import { apiJson } from './client'

export type Project = {
  id: string
  name: string
  description: string | null
  owner_id: string
  kind: ProjectKind
  created_at: string
  updated_at: string
  my_role?: ProjectRole | null
}

export type ProjectShare = {
  enabled: boolean
  share_id: string | null
  expires_at: string | null
  hidden_columns: string[]
}

export function applyStarterTasks(token: string, projectId: string): Promise<unknown[]> {
  return apiJson<unknown[]>(`/projects/${projectId}/starter-tasks`, token, { method: 'POST' })
}

export function listProjects(token: string): Promise<Project[]> {
  return apiJson<Project[]>('/projects', token)
}

export function createProject(
  token: string,
  body: { name: string; description?: string | null; kind?: ProjectKind },
): Promise<Project> {
  return apiJson<Project>('/projects', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteProject(token: string, projectId: string): Promise<void> {
  return apiJson<void>(`/projects/${projectId}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}

export function readProjectShare(token: string, projectId: string): Promise<ProjectShare> {
  return apiJson<ProjectShare>(`/projects/${projectId}/share`, token)
}

export function enableProjectShare(
  token: string,
  projectId: string,
  body?: { expires_in_days?: number; hidden_columns?: string[] },
): Promise<ProjectShare> {
  return apiJson<ProjectShare>(`/projects/${projectId}/share/enable`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function updateProjectShare(
  token: string,
  projectId: string,
  body: { expires_in_days?: number; hidden_columns?: string[]; clear_expiry?: boolean },
): Promise<ProjectShare> {
  return apiJson<ProjectShare>(`/projects/${projectId}/share`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function disableProjectShare(token: string, projectId: string): Promise<ProjectShare> {
  return apiJson<ProjectShare>(`/projects/${projectId}/share/disable`, token, {
    method: 'PUT',
  })
}
