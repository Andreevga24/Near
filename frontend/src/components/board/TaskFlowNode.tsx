import type { Node, NodeProps } from '@xyflow/react'
import type { Task } from '../../api/tasks'
import { useBoardFlowExtras } from './boardFlowContext'

export type TaskFlowNodeData = {
  task: Task
}

export type TaskFlowRfNode = Node<TaskFlowNodeData, 'taskNode'>

export function TaskFlowNode({ data }: NodeProps<TaskFlowRfNode>) {
  const { task } = data
  const { onMoveNext, onDelete } = useBoardFlowExtras()

  return (
    <div className="w-[250px] rounded-lg border border-slate-700 bg-slate-950/95 p-2.5 text-left shadow-lg">
      <p className="text-sm font-medium leading-snug text-slate-100">{task.title}</p>
      {task.description ? (
        <p className="nodrag mt-1 max-h-16 overflow-y-auto text-xs text-slate-500">{task.description}</p>
      ) : null}
      <div className="nodrag mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          onClick={() => onMoveNext(task)}
        >
          Дальше →
        </button>
        <button
          type="button"
          className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/30"
          onClick={() => onDelete(task)}
        >
          Удалить
        </button>
      </div>
    </div>
  )
}
