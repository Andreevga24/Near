/**
 * Вызовы эндпоинтов аутентификации FastAPI Users.
 */

import { API_BASE_URL } from '../config'

/** Ответ прокси Vite, если на :8000 никто не слушает (backend не запущен). */
const MSG_UPSTREAM_DOWN =
  'Сервер API на порту 8000 не запущен или не отвечает. В корне репозитория выполните: .\\scripts\\start-backend.ps1 (интернет для pip; Docker опционально для Redis). Либо вручную в backend: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000.'

function throwIfBadGateway(res: Response): void {
  // 502/504 — обычно прокси Vite, когда процесс на :8000 не слушает.
  // 503 оставляем для ответа самого API (например «база данных недоступна»).
  if (res.status === 502 || res.status === 504) {
    throw new ApiError(res.status, { detail: MSG_UPSTREAM_DOWN })
  }
}

/** Публичный профиль пользователя (как в UserRead на backend). */
export type UserMe = {
  id: string
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
  created_at: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

/** Регистрация: POST /register, JSON { email, password }. */
export async function registerUser(
  email: string,
  password: string,
): Promise<UserMe> {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throwIfBadGateway(res)
    const err = await safeJson(res)
    throw new ApiError(res.status, err)
  }
  return (await res.json()) as UserMe
}

/**
 * Вход: POST /login, форма OAuth2 (username = email в терминах FastAPI Users).
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.set('username', email)
  body.set('password', password)

  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    throwIfBadGateway(res)
    const err = await safeJson(res)
    throw new ApiError(res.status, err)
  }
  return (await res.json()) as TokenResponse
}

/** Текущий пользователь: GET /me с Bearer. */
export async function fetchMe(accessToken: string): Promise<UserMe> {
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throwIfBadGateway(res)
    const err = await safeJson(res)
    throw new ApiError(res.status, err)
  }
  return (await res.json()) as UserMe
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { detail: res.statusText }
  }
}

/** Унифицированная ошибка API для отображения в форме. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Человекочитаемое сообщение из тела ответа FastAPI. */
export function formatApiError(body: unknown): string {
  if (body == null) return 'Неизвестная ошибка'
  if (typeof body === 'string') return body
  if (typeof body !== 'object') return String(body)
  const o = body as Record<string, unknown>
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail)) {
    return o.detail
      .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x)))
      .join('; ')
  }
  if (o.detail && typeof o.detail === 'object' && 'reason' in (o.detail as object)) {
    return String((o.detail as { reason?: string }).reason ?? JSON.stringify(o.detail))
  }
  return JSON.stringify(body)
}
