/**
 * Доска задач в виде нод (React Flow): колонки по типу проекта, drag — смена статуса.
 */

import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Task } from '../../api/tasks'
import { labelStatusColumn } from '../../constants/boardPresets'
import type { ProjectKind } from '../../constants/projectKinds'
import { BoardFlowExtrasProvider } from './boardFlowContext'
import type { FlowExtras } from './boardFlowTypes'
import { ColumnLabelNode } from './ColumnLabelNode'
import { TaskFlowNode, type TaskFlowRfNode } from './TaskFlowNode'

const COL_WIDTH = 280
const HEADER_Y = 8
const HEADER_GAP = 56
const ROW_HEIGHT = 120
const NODE_WIDTH = 250

const nodeTypes = {
  taskNode: TaskFlowNode,
  columnLabel: ColumnLabelNode,
}

function tasksByStatusMap(tasks: Task[]): Map<string, Task[]> {
  const m = new Map<string, Task[]>()
  for (const t of tasks) {
    const arr = m.get(t.status) ?? []
    arr.push(t)
    m.set(t.status, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  }
  return m
}

function layoutNodes(columns: string[], tasks: Task[]): Node[] {
  const byStatus = tasksByStatusMap(tasks)
  const nodes: Node[] = []
  columns.forEach((status, ci) => {
    const x = ci * COL_WIDTH
    nodes.push({
      id: `col-${status}`,
      type: 'columnLabel',
      position: { x, y: HEADER_Y },
      data: { title: labelStatusColumn(status), slug: status },
      draggable: false,
      selectable: false,
      focusable: false,
    })
    const list = byStatus.get(status) ?? []
    list.forEach((task, j) => {
      const n: TaskFlowRfNode = {
        id: task.id,
        type: 'taskNode',
        position: { x, y: HEADER_GAP + j * ROW_HEIGHT },
        data: { task },
        draggable: true,
      }
      nodes.push(n)
    })
  })
  return nodes
}

function columnIndexFromNodeX(x: number): number {
  const center = x + NODE_WIDTH / 2
  return Math.max(0, Math.floor(center / COL_WIDTH))
}

function FitViewOnLayout({ layoutKey }: { layoutKey: string }) {
  const rf = useReactFlow()
  useEffect(() => {
    queueMicrotask(() => rf.fitView({ padding: 0.12 }))
  }, [layoutKey, rf])
  return null
}

export type TaskBoardGraphProps = {
  kind: ProjectKind
  columns: string[]
  tasks: Task[]
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
  onTaskStatusChange: (task: Task, newStatus: string) => Promise<void>
}

function TaskBoardGraphInner({
  kind,
  columns,
  tasks,
  onMoveNext,
  onDelete,
  onTaskStatusChange,
}: TaskBoardGraphProps) {
  const extrasRef = useRef<FlowExtras>({ onMoveNext, onDelete })
  useEffect(() => {
    extrasRef.current = { onMoveNext, onDelete }
  }, [onMoveNext, onDelete])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    layoutNodes(columns, tasks),
  )

  useEffect(() => {
    setNodes(layoutNodes(columns, tasks))
  }, [columns, tasks, kind, setNodes])

  const relayout = useCallback(() => {
    setNodes(layoutNodes(columns, tasks))
  }, [columns, tasks, setNodes])

  const onNodeDragStop = useCallback<OnNodeDrag<Node>>(
    async (_evt: ReactMouseEvent, node) => {
      if (node.type !== 'taskNode' || columns.length === 0) return
      const task = (node.data as TaskFlowRfNode['data']).task
      const idx = Math.min(columns.length - 1, columnIndexFromNodeX(node.position.x))
      const newStatus = columns[idx]
      if (!newStatus || newStatus === task.status) {
        relayout()
        return
      }
      try {
        await onTaskStatusChange(task, newStatus)
      } catch {
        relayout()
      }
    },
    [columns, onTaskStatusChange, relayout],
  )

  const layoutKey = `${columns.join('|')}:${tasks.map((t) => `${t.id}:${t.status}`).join(',')}`

  return (
    <BoardFlowExtrasProvider getExtras={() => extrasRef.current}>
      <div className="h-[min(72vh,760px)] min-h-[420px] w-full rounded-xl border border-slate-800 bg-slate-950 [&_.react-flow\_\_attribution]:hidden">
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          nodesConnectable={false}
          elementsSelectable
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
          minZoom={0.35}
          maxZoom={1.25}
          className="bg-slate-950"
        >
          <FitViewOnLayout layoutKey={layoutKey} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#334155" />
          <Controls className="!border-slate-700 !bg-slate-900 [&_button]:!border-slate-600 [&_button]:!bg-slate-800 [&_button]:!fill-slate-200" />
          <MiniMap
            className="!border-slate-700 !bg-slate-900"
            nodeStrokeWidth={2}
            nodeColor={(n) => (n.type === 'columnLabel' ? '#475569' : '#5b21b6')}
            maskColor="rgb(15 23 42 / 0.75)"
          />
        </ReactFlow>
      </div>
    </BoardFlowExtrasProvider>
  )
}

export function TaskBoardGraph(props: TaskBoardGraphProps) {
  return (
    <ReactFlowProvider>
      <TaskBoardGraphInner {...props} />
    </ReactFlowProvider>
  )
}

export type { FlowExtras } from './boardFlowTypes'
