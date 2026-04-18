import type { ProjectKind } from '../constants/projectKinds'
import { apiJson } from './client'

export type Project = {
  id: string
  name: string
  description: string | null
  owner_id: string
  kind: ProjectKind
  created_at: string
  updated_at: string
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
