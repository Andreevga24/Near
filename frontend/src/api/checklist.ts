import { apiJson } from './client'

export type ChecklistItem = {
  id: string
  task_id: string
  text: string
  is_done: boolean
  position: number
  created_at: string
}

export function listChecklistItems(token: string, taskId: string): Promise<ChecklistItem[]> {
  const q = new URLSearchParams({ task_id: taskId })
  return apiJson<ChecklistItem[]>(`/checklist-items?${q}`, token)
}

export function createChecklistItem(
  token: string,
  body: { task_id: string; text: string; position?: number | null },
): Promise<ChecklistItem> {
  return apiJson<ChecklistItem>('/checklist-items', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateChecklistItem(
  token: string,
  itemId: string,
  body: Partial<{ text: string; is_done: boolean; position: number }>,
): Promise<ChecklistItem> {
  return apiJson<ChecklistItem>(`/checklist-items/${itemId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteChecklistItem(token: string, itemId: string): Promise<void> {
  return apiJson<void>(`/checklist-items/${itemId}`, token, { method: 'DELETE', parseJson: false })
}

export function reorderChecklistItems(
  token: string,
  body: { task_id: string; ordered_item_ids: string[] },
): Promise<void> {
  return apiJson<void>('/checklist-items/reorder', token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    parseJson: false,
  })
}

