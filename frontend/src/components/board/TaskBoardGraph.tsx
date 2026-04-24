/**
 * Доска задач в виде нод (React Flow): колонки по типу проекта, drag — смена статуса.
 */

import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type OnNodeDrag,
  type OnConnect,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Task } from '../../api/tasks'
import type { TaskLink, TaskLinkType } from '../../api/taskLinks'
import { hintForStatus, labelStatusColumn } from '../../constants/boardPresets'
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

function buildLinkStats(links: TaskLink[]) {
  const inBlocks = new Map<string, number>()
  const outBlocks = new Map<string, number>()
  const relates = new Map<string, number>()
  for (const l of links) {
    if (l.type === 'blocks') {
      outBlocks.set(l.from_task_id, (outBlocks.get(l.from_task_id) ?? 0) + 1)
      inBlocks.set(l.to_task_id, (inBlocks.get(l.to_task_id) ?? 0) + 1)
    } else if (l.type === 'relates') {
      relates.set(l.from_task_id, (relates.get(l.from_task_id) ?? 0) + 1)
    }
  }
  return { inBlocks, outBlocks, relates }
}

function layoutNodes(
  kind: ProjectKind,
  hints: Record<string, string> | null | undefined,
  columns: string[],
  tasks: Task[],
  links: TaskLink[],
  showCheckpoints: boolean,
): Node[] {
  const byStatus = tasksByStatusMap(tasks)
  const stats = showCheckpoints ? buildLinkStats(links) : null
  const nodes: Node[] = []
  columns.forEach((status, ci) => {
    const x = ci * COL_WIDTH
    const hint = (hints && hints[status]) || hintForStatus(kind, status)
    nodes.push({
      id: `col-${status}`,
      type: 'columnLabel',
      position: { x, y: HEADER_Y },
      data: { title: labelStatusColumn(status), slug: status, hint },
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
        data: {
          task,
          showCheckpoints,
          badges: stats
            ? {
                inBlocks: stats.inBlocks.get(task.id) ?? 0,
                outBlocks: stats.outBlocks.get(task.id) ?? 0,
                relates: stats.relates.get(task.id) ?? 0,
              }
            : undefined,
        },
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
  hints?: Record<string, string> | null
  columns: string[]
  tasks: Task[]
  links: TaskLink[]
  readOnly?: boolean
  /** Плашки связей (←blocks/→blocks/↔relates) показывать только при открытой панели задачи. */
  showCheckpoints?: boolean
  onMovePrev: (task: Task) => void
  onMoveNext: (task: Task) => void
  onDelete: (task: Task) => void
  onOpenTask: (task: Task) => void
  onTaskStatusChange: (task: Task, newStatus: string) => Promise<void>
  onCreateLink: (fromTaskId: string, toTaskId: string, type: TaskLinkType) => Promise<void>
  onDeleteLink: (fromTaskId: string, toTaskId: string, type: TaskLinkType) => Promise<void>
}

function TaskBoardGraphInner({
  kind,
  hints,
  columns,
  tasks,
  links,
  readOnly = false,
  showCheckpoints = false,
  onMovePrev,
  onMoveNext,
  onDelete,
  onOpenTask,
  onTaskStatusChange,
  onCreateLink,
  onDeleteLink,
}: TaskBoardGraphProps) {
  const extrasRef = useRef<FlowExtras>({ onMovePrev, onMoveNext, onDelete, onOpenTask })
  useEffect(() => {
    extrasRef.current = { onMovePrev, onMoveNext, onDelete, onOpenTask }
  }, [onMovePrev, onMoveNext, onDelete, onOpenTask])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    layoutNodes(kind, hints, columns, tasks, links, showCheckpoints),
  )

  useEffect(() => {
    const laidOut = layoutNodes(kind, hints, columns, tasks, links, showCheckpoints).map((n) => {
      if (!readOnly) return n
      if (n.type === 'taskNode') return { ...n, draggable: false }
      return n
    })
    setNodes(laidOut)
  }, [columns, tasks, links, kind, hints, readOnly, showCheckpoints, setNodes])

  const relayout = useCallback(() => {
    setNodes(layoutNodes(kind, hints, columns, tasks, links, showCheckpoints))
  }, [kind, hints, columns, tasks, links, showCheckpoints, setNodes])

  const edges = useMemo<Edge[]>(() => {
    const known = new Set(tasks.map((t) => t.id))
    const out: Edge[] = []
    const relatesSeen = new Set<string>()

    for (const l of links) {
      if (!known.has(l.from_task_id) || !known.has(l.to_task_id)) continue
      if (l.from_task_id === l.to_task_id) continue

      if (l.type === 'blocks') {
        out.push({
          id: `blocks:${l.from_task_id}->${l.to_task_id}`,
          source: l.from_task_id,
          target: l.to_task_id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        })
        continue
      }

      // relates хранится как две направленные записи — рисуем один раз.
      const a = l.from_task_id < l.to_task_id ? l.from_task_id : l.to_task_id
      const b = l.from_task_id < l.to_task_id ? l.to_task_id : l.from_task_id
      const key = `${a}::${b}`
      if (relatesSeen.has(key)) continue
      relatesSeen.add(key)
      out.push({
        id: `relates:${a}<->${b}`,
        source: a,
        target: b,
        type: 'smoothstep',
        style: { stroke: '#64748b', strokeWidth: 1.25, strokeDasharray: '6 4' },
      })
    }

    return out
  }, [links, tasks])

  const onNodeDragStop = useCallback<OnNodeDrag<Node>>(
    async (_evt: ReactMouseEvent, node) => {
      if (readOnly) return
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
    [columns, onTaskStatusChange, relayout, readOnly],
  )

  const onConnect = useCallback<OnConnect>(
    async (conn: Connection) => {
      if (readOnly) return
      const from = conn.source
      const to = conn.target
      if (!from || !to || from === to) return
      try {
        await onCreateLink(from, to, 'blocks')
      } catch {
        /* ошибки показываются страницей */
      }
    },
    [onCreateLink, readOnly],
  )

  const onEdgeClick = useCallback<EdgeMouseHandler>(
    async (_evt, edge) => {
      if (readOnly) return
      const id = edge.id ?? ''
      if (id.startsWith('blocks:')) {
        const rest = id.slice('blocks:'.length)
        const [from, to] = rest.split('->')
        if (!from || !to) return
        if (!window.confirm('Удалить связь blocks?')) return
        try {
          await onDeleteLink(from, to, 'blocks')
        } catch {
          /* ошибки показываются страницей */
        }
        return
      }
      if (id.startsWith('relates:')) {
        const rest = id.slice('relates:'.length)
        const [a, b] = rest.split('<->')
        if (!a || !b) return
        if (!window.confirm('Удалить связь relates?')) return
        try {
          await onDeleteLink(a, b, 'relates')
        } catch {
          /* ошибки показываются страницей */
        }
      }
    },
    [onDeleteLink, readOnly],
  )

  const layoutKey = `${columns.join('|')}:${tasks.map((t) => `${t.id}:${t.status}`).join(',')}`

  return (
    <BoardFlowExtrasProvider getExtras={() => extrasRef.current}>
      <div className="h-[min(72vh,760px)] min-h-[420px] w-full rounded-xl border border-slate-800 bg-slate-950 [&_.react-flow\_\_attribution]:hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
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
