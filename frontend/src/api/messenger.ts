import { apiJson } from './client'

export type ChatChannel = {
  id: string
  title: string
  project_id: string | null
  task_id: string | null
  created_by_user_id: string
  created_at: string
  message_count: number
}

export type ChatMessage = {
  id: string
  channel_id: string
  user_id: string
  author_email: string
  text: string
  created_at: string
}

export function listChatChannels(token: string): Promise<ChatChannel[]> {
  return apiJson<ChatChannel[]>('/messenger/channels', token)
}

export function createChatChannel(
  token: string,
  payload: { title: string; project_id?: string; task_id?: string },
): Promise<ChatChannel> {
  return apiJson<ChatChannel>('/messenger/channels', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function listChatMessages(token: string, channelId: string): Promise<ChatMessage[]> {
  return apiJson<ChatMessage[]>(`/messenger/channels/${channelId}/messages`, token)
}

export function postChatMessage(token: string, channelId: string, text: string): Promise<ChatMessage> {
  return apiJson<ChatMessage>(`/messenger/channels/${channelId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}
