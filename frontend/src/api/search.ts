import { apiJson } from './client'

export type SearchResult = {
  query: string
  projects: Array<{ id: string; name: string; kind: string }>
  tasks: Array<{ id: string; title: string; project_id: string; project_name: string; status: string }>
}

export function globalSearch(token: string, q: string, limit = 20): Promise<SearchResult> {
  const params = new URLSearchParams({ q, limit: String(limit) })
  return apiJson<SearchResult>(`/search?${params}`, token)
}
