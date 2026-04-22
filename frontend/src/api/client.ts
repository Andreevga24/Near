/**
 * Общие запросы к API с Bearer (префикс /api в dev — см. vite.config).
 */

import { API_BASE_URL } from '../config'

import { ApiError } from './auth'
import { enqueueOfflineRequest } from './offlineQueue'

const MSG_UPSTREAM_DOWN =
  'Сервер API на порту 8000 не запущен или не отвечает. Запустите backend (uvicorn на :8000).'

function throwIfBadGateway(res: Response): void {
  if (res.status === 502 || res.status === 504) {
    throw new ApiError(res.status, { detail: MSG_UPSTREAM_DOWN })
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { detail: res.statusText }
  }
}

export async function apiJson<T>(
  path: string,
  token: string,
  init: RequestInit & { parseJson?: boolean } = {},
): Promise<T> {
  const { parseJson = true, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set('Authorization', `Bearer ${token}`)

  const method = (rest.method ?? 'GET').toUpperCase()
  const isMutation = method !== 'GET' && method !== 'HEAD'

  if (isMutation && typeof navigator !== 'undefined' && navigator.onLine === false) {
    // queue and return undefined; UI should refresh after sync
    let body: unknown | null = null
    if (typeof rest.body === 'string') {
      try {
        body = JSON.parse(rest.body)
      } catch {
        body = rest.body
      }
    }
    enqueueOfflineRequest({ method, path, body })
    return undefined as T
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers })
  } catch (e) {
    // Network error: if mutation — queue
    if (isMutation) {
      let body: unknown | null = null
      if (typeof rest.body === 'string') {
        try {
          body = JSON.parse(rest.body)
        } catch {
          body = rest.body
        }
      }
      enqueueOfflineRequest({ method, path, body })
      return undefined as T
    }
    throw e
  }
  throwIfBadGateway(res)

  if (res.status === 204 || res.status === 205) {
    return undefined as T
  }
  if (!res.ok) {
    throw new ApiError(res.status, await safeJson(res))
  }
  if (!parseJson) {
    return undefined as T
  }
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
