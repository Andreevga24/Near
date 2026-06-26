import { apiJson } from './client'

export type SupportTicketStatus = 'draft' | 'open' | 'in_progress' | 'resolved' | 'closed'

export type SupportTicket = {
  id: string
  subject: string
  body: string
  email: string
  status: SupportTicketStatus
  created_at: string
  updated_at: string
  reply_count: number
}

export type SupportTicketReply = {
  id: string
  ticket_id: string
  user_id: string
  author_email: string
  body: string
  created_at: string
}

export type SupportTicketDetail = SupportTicket & {
  replies: SupportTicketReply[]
}

export function listSupportTickets(token: string): Promise<SupportTicket[]> {
  return apiJson<SupportTicket[]>('/support/tickets', token)
}

export function createSupportTicket(
  token: string,
  payload: { subject: string; body: string; status: 'draft' | 'open' },
): Promise<SupportTicket> {
  return apiJson<SupportTicket>('/support/tickets', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getSupportTicket(token: string, ticketId: string): Promise<SupportTicketDetail> {
  return apiJson<SupportTicketDetail>(`/support/tickets/${ticketId}`, token)
}

export function updateSupportTicket(
  token: string,
  ticketId: string,
  payload: Partial<{ subject: string; body: string; status: SupportTicketStatus }>,
): Promise<SupportTicket> {
  return apiJson<SupportTicket>(`/support/tickets/${ticketId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteSupportTicket(token: string, ticketId: string): Promise<void> {
  return apiJson<void>(`/support/tickets/${ticketId}`, token, { method: 'DELETE' })
}

export function addSupportReply(
  token: string,
  ticketId: string,
  body: string,
): Promise<SupportTicketReply> {
  return apiJson<SupportTicketReply>(`/support/tickets/${ticketId}/replies`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
}
