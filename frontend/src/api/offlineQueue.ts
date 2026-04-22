type QueuedRequest = {
  id: string
  created_at: string
  method: string
  path: string
  body: unknown | null
}

const STORAGE_KEY = 'near_offline_queue_v1'
export const OFFLINE_QUEUE_CHANGED_EVENT = 'near_offline_queue_changed'

function readQueue(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as QueuedRequest[]) : []
  } catch {
    return []
  }
}

function writeQueue(items: QueuedRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
}

function uid(): string {
  // good enough for client-side queue ids
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function enqueueOfflineRequest(req: Omit<QueuedRequest, 'id' | 'created_at'>): string {
  const q = readQueue()
  const item: QueuedRequest = {
    id: uid(),
    created_at: new Date().toISOString(),
    ...req,
  }
  q.push(item)
  writeQueue(q)
  // writeQueue dispatches change event
  return item.id
}

export function getOfflineQueueSize(): number {
  return readQueue().length
}

export async function drainOfflineQueue(options: {
  token: string
  apiBaseUrl: string
}): Promise<{ processed: number; remaining: number }> {
  const { token, apiBaseUrl } = options
  const q = readQueue()
  if (q.length === 0) return { processed: 0, remaining: 0 }

  const remaining: QueuedRequest[] = []
  let processed = 0

  for (const item of q) {
    try {
      const res = await fetch(`${apiBaseUrl}${item.path}`, {
        method: item.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(item.body != null ? { 'Content-Type': 'application/json' } : {}),
        },
        body: item.body != null ? JSON.stringify(item.body) : undefined,
      })
      if (!res.ok) {
        // If auth is invalid or request is bad, keep it (user might need to login / inspect later).
        remaining.push(item)
        continue
      }
      processed += 1
    } catch {
      // still offline / network error
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return { processed, remaining: remaining.length }
}

