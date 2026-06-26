import { apiJson } from './client'

export type KindPreset = {
  kind: string
  column_hints: Record<string, string>
  default_checklists: Record<string, string[]>
  starter_tasks: Array<{ title: string; status: string }>
}

export function fetchKindPreset(token: string, kind: string): Promise<KindPreset> {
  return apiJson<KindPreset>(`/presets/${encodeURIComponent(kind)}`, token)
}

export function saveKindPreset(
  token: string,
  kind: string,
  body: {
    column_hints: Record<string, string>
    default_checklists: Record<string, string[]>
    starter_tasks?: Array<{ title: string; status: string }>
  },
): Promise<KindPreset> {
  return apiJson<KindPreset>(`/presets/${encodeURIComponent(kind)}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function exportKindPreset(token: string, kind: string): Promise<KindPreset> {
  return apiJson<KindPreset>(`/presets/${encodeURIComponent(kind)}/export`, token)
}
