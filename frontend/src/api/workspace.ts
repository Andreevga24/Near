import { apiJson } from './client'

export type WorkspaceStoreKey = 'company' | 'messenger' | 'support' | 'profile'

export type WorkspaceStore<T> = {
  store_key: WorkspaceStoreKey
  data: T | null
  updated_at: string | null
}

export function readWorkspaceStore<T>(
  token: string,
  storeKey: WorkspaceStoreKey,
): Promise<WorkspaceStore<T>> {
  return apiJson<WorkspaceStore<T>>(`/workspace/${storeKey}`, token)
}

export function saveWorkspaceStore<T extends Record<string, unknown>>(
  token: string,
  storeKey: WorkspaceStoreKey,
  data: T,
): Promise<WorkspaceStore<T>> {
  return apiJson<WorkspaceStore<T>>(`/workspace/${storeKey}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
}

export function deleteWorkspaceStore(
  token: string,
  storeKey: WorkspaceStoreKey,
): Promise<void> {
  return apiJson<void>(`/workspace/${storeKey}`, token, {
    method: 'DELETE',
    parseJson: false,
  })
}
