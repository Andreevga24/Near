import { apiJson } from './client'

export type GanttTask = {
  id: string
  title: string
  status: string
  assignee_id: string | null
  start_at: string
  end_at: string
  blocked_by: string[]
}

export type GanttLink = {
  from_task_id: string
  to_task_id: string
  type: string
}

export type GanttData = {
  project_id: string
  project_name: string
  range_start: string
  range_end: string
  tasks: GanttTask[]
  links: GanttLink[]
}

export function fetchProjectGantt(token: string, projectId: string): Promise<GanttData> {
  return apiJson<GanttData>(`/projects/${encodeURIComponent(projectId)}/gantt`, token)
}
