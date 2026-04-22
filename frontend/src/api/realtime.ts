/**
 * URL WebSocket задач проекта (тот же JWT, что и для REST).
 * В dev с `API_BASE_URL === '/api'` используется хост страницы и прокси Vite (ws: true).
 */

import { API_BASE_URL } from '../config'

export function projectTasksWebSocketUrl(projectId: string, token: string): string {
  const q = `token=${encodeURIComponent(token)}`
  if (API_BASE_URL.startsWith('/')) {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${window.location.host}${API_BASE_URL}/ws/${projectId}?${q}`
  }
  const base = new URL(API_BASE_URL)
  const wsProto = base.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProto}//${base.host}/ws/${projectId}?${q}`
}
