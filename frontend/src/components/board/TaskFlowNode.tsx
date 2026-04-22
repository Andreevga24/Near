import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { Task } from '../../api/tasks'
import { useBoardFlowExtras } from './boardFlowContext'

export type TaskFlowNodeData = {
  task: Task
  badges?: {
    inBlocks: number
    outBlocks: number
    relates: number
  }
}

export type TaskFlowRfNode = Node<TaskFlowNodeData, 'taskNode'>

export function TaskFlowNode({ data }: NodeProps<TaskFlowRfNode>) {
  const { task, badges } = data
  const { onMovePrev, onMoveNext, onDelete, onOpenTask } = useBoardFlowExtras()

  return (
    <div className="relative w-[250px] rounded-lg border border-slate-700 bg-slate-950/95 p-2.5 text-left shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-slate-500 !bg-slate-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-slate-500 !bg-slate-800"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenTask(task)} className="text-left">
            <p className="truncate text-sm font-medium leading-snug text-slate-100 hover:text-white">{task.title}</p>
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpenTask(task)
          }}
          className="nodrag shrink-0 rounded border border-slate-700 bg-slate-900/40 p-1 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          aria-label="Открыть панель задачи"
          title="Открыть панель"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              d="M9 21H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M13 9h6v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 9l-9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {badges ? (
          <div className="nodrag mt-0.5 shrink-0 text-[10px] text-slate-500">
            {badges.inBlocks > 0 ? (
              <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5">←{badges.inBlocks}</span>
            ) : null}
            {badges.outBlocks > 0 ? (
              <span className="ml-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5">→{badges.outBlocks}</span>
            ) : null}
            {badges.relates > 0 ? (
              <span className="ml-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5">↔{badges.relates}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {task.description ? (
        <p className="nodrag mt-1 max-h-16 overflow-y-auto text-xs text-slate-500">{task.description}</p>
      ) : null}
      <div className="nodrag mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          onClick={() => onMovePrev(task)}
          aria-label="Назад"
        >
          ←
        </button>
        <button
          type="button"
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          onClick={() => onMoveNext(task)}
          aria-label="Вперёд"
        >
          →
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
