import { API_BASE_URL } from '../config'

import { apiJson } from './client'

export type ReportsSummary = {
  project_id: string | null
  active_total: number
  archived_total: number
  closed_last_7_days: number
  closed_last_30_days: number
  with_due: number
  overdue: number
  due_soon: number
  by_status: Array<{ status: string; count: number }>
  by_project: Array<{
    project_id: string
    project_name: string
    active_total: number
    archived_total: number
  }>
}

export type ReportsDashboard = {
  project_id: string | null
  burndown: Array<{ date: string; closed_count: number; remaining_active: number }>
  in_progress: Array<{ status: string; count: number }>
  overdue_by_assignee: Array<{
    assignee_id: string | null
    assignee_email: string | null
    overdue_count: number
    in_progress_count: number
  }>
  time_total_seconds: number
}

export function fetchReportsSummary(token: string, projectId?: string): Promise<ReportsSummary> {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  return apiJson<ReportsSummary>(`/reports/summary${q}`, token)
}

export function fetchReportsDashboard(token: string, projectId?: string, days = 14): Promise<ReportsDashboard> {
  const q = new URLSearchParams({ days: String(days) })
  if (projectId) q.set('project_id', projectId)
  return apiJson<ReportsDashboard>(`/reports/dashboard?${q}`, token)
}

export async function downloadReportsExport(
  token: string,
  format: 'csv' | 'pdf',
  projectId?: string,
): Promise<void> {
  const q = new URLSearchParams({ format })
  if (projectId) q.set('project_id', projectId)
  const res = await fetch(`${API_BASE_URL}/reports/export?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = format === 'pdf' ? 'near-report.pdf' : 'near-report.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}
