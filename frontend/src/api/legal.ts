import { API_BASE_URL } from '../config'

export type LegalMeta = {
  privacy_version: string
  terms_version: string
  consent_version: string
  operator_name: string
  operator_email: string
}

export async function fetchLegalMeta(): Promise<LegalMeta> {
  const res = await fetch(`${API_BASE_URL}/legal/meta`)
  if (!res.ok) throw new Error(`legal meta: ${res.status}`)
  return (await res.json()) as LegalMeta
}

export type RegisterPayload = {
  email: string
  password: string
  accept_privacy: boolean
  accept_terms: boolean
  privacy_version: string
  terms_version: string
}

export async function downloadAccountExport(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/account/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`export: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'near-data-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password, confirmation: 'DELETE' }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`
    throw new Error(detail)
  }
}
