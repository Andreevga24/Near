import type { Task } from '../../api/tasks'

export type FlowExtras = {
  onMovePrev: (task: Task) => void
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenTask: (task: Task) => void
}
