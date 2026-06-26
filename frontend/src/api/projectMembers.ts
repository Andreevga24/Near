import { apiJson } from './client'

export type ProjectRole = 'owner' | 'editor' | 'viewer'

export type ProjectMember = {
  user_id: string
  email: string
  role: ProjectRole | string
  is_owner: boolean
  joined_at: string | null
}

export type ProjectMembersResponse = {
  project_id: string
  members: ProjectMember[]
}

export type ProjectInvite = {
  id: string
  email: string
  role: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export type ProjectInviteCreated = {
  invite: ProjectInvite
  accept_path: string
}

export type Colleague = {
  id: string
  email: string
}

export function listProjectMembers(token: string, projectId: string): Promise<ProjectMembersResponse> {
  return apiJson<ProjectMembersResponse>(`/projects/${projectId}/members`, token)
}

export function addProjectMember(
  token: string,
  projectId: string,
  body: { email: string; role: 'editor' | 'viewer' },
): Promise<ProjectMember> {
  return apiJson<ProjectMember>(`/projects/${projectId}/members`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateProjectMemberRole(
  token: string,
  projectId: string,
  userId: string,
  role: 'editor' | 'viewer',
): Promise<ProjectMember> {
  return apiJson<ProjectMember>(`/projects/${projectId}/members/${userId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

export function removeProjectMember(token: string, projectId: string, userId: string): Promise<void> {
  return apiJson<void>(`/projects/${projectId}/members/${userId}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}

export function listProjectInvites(token: string, projectId: string): Promise<ProjectInvite[]> {
  return apiJson<ProjectInvite[]>(`/projects/${projectId}/invites`, token)
}

export function createProjectInvite(
  token: string,
  projectId: string,
  body: { email: string; role: 'editor' | 'viewer' },
): Promise<ProjectInviteCreated> {
  return apiJson<ProjectInviteCreated>(`/projects/${projectId}/invites`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function revokeProjectInvite(token: string, projectId: string, inviteId: string): Promise<void> {
  return apiJson<void>(`/projects/${projectId}/invites/${inviteId}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}

export function acceptProjectInvite(token: string, inviteToken: string): Promise<ProjectMember> {
  return apiJson<ProjectMember>('/project-invites/accept', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: inviteToken }),
  })
}

export function listColleagues(token: string): Promise<Colleague[]> {
  return apiJson<Colleague[]>('/users/colleagues', token)
}

export function projectRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'owner':
      return 'Владелец'
    case 'editor':
      return 'Редактор'
    case 'viewer':
      return 'Наблюдатель'
    default:
      return role ?? '—'
  }
}
