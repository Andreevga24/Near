import { useEffect, useRef } from 'react'

import { projectTasksWebSocketUrl } from '../api/realtime'
import { emitTasksChanged } from '../nearEvents'

type WsMessage =
  | { type: 'task_created'; task_id: string; project_id: string }
  | { type: 'task_updated'; task_id: string; project_id: string }
  | { type: 'task_deleted'; task_id: string; project_id: string }
  | { type: 'project_deleted'; project_id: string }
  | {
      type: 'link_created' | 'link_deleted'
      project_id: string
      from_task_id: string
      to_task_id: string
      link_type: 'blocks' | 'relates'
    }

function parseWsPayload(raw: unknown): WsMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.type === 'project_deleted' && typeof o.project_id === 'string') {
    return { type: 'project_deleted', project_id: o.project_id }
  }
  if (
    (o.type === 'link_created' || o.type === 'link_deleted') &&
    typeof o.project_id === 'string' &&
    typeof o.from_task_id === 'string' &&
    typeof o.to_task_id === 'string' &&
    (o.link_type === 'blocks' || o.link_type === 'relates')
  ) {
    return {
      type: o.type,
      project_id: o.project_id,
      from_task_id: o.from_task_id,
      to_task_id: o.to_task_id,
      link_type: o.link_type,
    }
  }
  if (
    (o.type === 'task_created' || o.type === 'task_updated' || o.type === 'task_deleted') &&
    typeof o.task_id === 'string' &&
    typeof o.project_id === 'string'
  ) {
    return { type: o.type, task_id: o.task_id, project_id: o.project_id }
  }
  return null
}

const RECONNECT_MS = 2500

/**
 * Подписка на события доски проекта (создание / изменение / удаление задач, удаление проекта).
 */
export function useProjectBoardWebSocket(options: {
  enabled: boolean
  projectId: string
  token: string
  onReloadTasks: () => Promise<void>
  onReloadLinks: () => Promise<void>
  onTaskDeleted: (taskId: string) => void
  onProjectDeleted: () => void
}): void {
  const { enabled, projectId, token, onReloadTasks, onReloadLinks, onTaskDeleted, onProjectDeleted } = options
  const handlersRef = useRef({ onReloadTasks, onReloadLinks, onTaskDeleted, onProjectDeleted })

  useEffect(() => {
    handlersRef.current = { onReloadTasks, onReloadLinks, onTaskDeleted, onProjectDeleted }
  }, [onReloadTasks, onReloadLinks, onTaskDeleted, onProjectDeleted])

  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const clearReconnect = () => {
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
    }

    const connect = () => {
      if (disposed) return
      clearReconnect()

      const url = projectTasksWebSocketUrl(projectId, token)
      socket = new WebSocket(url)

      socket.onmessage = (event) => {
        try {
          const raw: unknown = JSON.parse(event.data as string)
          const msg = parseWsPayload(raw)
          if (!msg || msg.project_id !== projectId) return

          const h = handlersRef.current
          if (msg.type === 'project_deleted') {
            h.onProjectDeleted()
            return
          }
          if (msg.type === 'link_created' || msg.type === 'link_deleted') {
            void (async () => {
              try {
                await h.onReloadLinks()
              } catch {
                /* ошибки REST обрабатывает страница */
              }
            })()
            return
          }
          if (msg.type === 'task_deleted') {
            h.onTaskDeleted(msg.task_id)
            emitTasksChanged()
            return
          }
          void (async () => {
            try {
              await h.onReloadTasks()
              emitTasksChanged()
            } catch {
              /* ошибки REST обрабатывает страница */
            }
          })()
        } catch {
          /* невалидный JSON */
        }
      }

      socket.onerror = () => {
        socket?.close()
      }

      socket.onclose = () => {
        socket = null
        if (disposed) return
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS)
      }
    }

    connect()

    return () => {
      disposed = true
      clearReconnect()
      socket?.close()
      socket = null
    }
  }, [enabled, projectId, token])
}
