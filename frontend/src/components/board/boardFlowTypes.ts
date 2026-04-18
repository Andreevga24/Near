import type { Task } from '../../api/tasks'

export type FlowExtras = {
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
}
