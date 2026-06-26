type QueuedRequest = {
  id: string
  created_at: string
  method: string
  path: string
  body: unknown | null
}

const STORAGE_KEY = 'near_offline_queue_v1'
export const OFFLINE_QUEUE_CHANGED_EVENT = 'near_offline_queue_changed'
const BROADCAST_CHANNEL = 'near_offline_queue_v1'

const TASK_PATH_RE = /^\/tasks\/([^/]+)(?:\/(close|restore))?$/

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

function notifyQueueChanged(items: QueuedRequest[]) {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT))
  try {
    new BroadcastChannel(BROADCAST_CHANNEL).postMessage({ type: 'changed', size: items.length })
  } catch {
    /* unsupported */
  }
}

function writeQueue(items: QueuedRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  notifyQueueChanged(items)
}

function uid(): string {
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
  return item.id
}

export function getOfflineQueueSize(): number {
  return readQueue().length
}

/** ID задач с несинхронизированными изменениями в очереди. */
export function getPendingTaskIds(): Set<string> {
  const ids = new Set<string>()
  for (const item of readQueue()) {
    const m = item.path.match(TASK_PATH_RE)
    if (m?.[1]) ids.add(m[1])
    if (item.path === '/checklist-items/reorder' && item.body && typeof item.body === 'object') {
      const taskId = (item.body as { task_id?: string }).task_id
      if (taskId) ids.add(taskId)
    }
    if (item.path.startsWith('/tasks/') && item.method === 'PUT') {
      const parts = item.path.split('/')
      if (parts[2]) ids.add(parts[2])
    }
  }
  return ids
}

export function subscribeOfflineQueue(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange()
  }
  const onLocal = () => onChange()
  let bc: BroadcastChannel | null = null
  try {
    bc = new BroadcastChannel(BROADCAST_CHANNEL)
    bc.onmessage = () => onChange()
  } catch {
    /* unsupported */
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onLocal)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onLocal)
    bc?.close()
  }
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
        remaining.push(item)
        continue
      }
      processed += 1
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return { processed, remaining: remaining.length }
}
