/**
 * Обновление текущего пользователя (FastAPI Users: PATCH /users/me).
 */

import { apiJson } from './client'
import type { UserMe } from './auth'

export async function patchCurrentUser(
  token: string,
  body: { email?: string; password?: string },
): Promise<UserMe> {
  return apiJson<UserMe>('/users/me', token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
