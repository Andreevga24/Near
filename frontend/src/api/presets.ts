import { apiJson } from './client'

export type KindPreset = {
  kind: string
  column_hints: Record<string, string>
  default_checklists: Record<string, string[]>
}

export function fetchKindPreset(token: string, kind: string): Promise<KindPreset> {
  return apiJson<KindPreset>(`/presets/${encodeURIComponent(kind)}`, token)
}

export function saveKindPreset(
  token: string,
  kind: string,
  body: { column_hints: Record<string, string>; default_checklists: Record<string, string[]> },
): Promise<KindPreset> {
  return apiJson<KindPreset>(`/presets/${encodeURIComponent(kind)}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

