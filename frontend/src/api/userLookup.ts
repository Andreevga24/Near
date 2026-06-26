import { apiJson } from './client'

export type ResolvedEmail = {
  email: string
  user_id: string
}

export function resolveEmails(token: string, emails: string[]): Promise<ResolvedEmail[]> {
  if (emails.length === 0) return Promise.resolve([])
  const q = encodeURIComponent(emails.join(','))
  return apiJson<ResolvedEmail[]>(`/users/resolve-emails?emails=${q}`, token)
}
