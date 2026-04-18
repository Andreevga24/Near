import type { Node, NodeProps } from '@xyflow/react'

export type ColumnLabelData = {
  title: string
  slug: string
}

export type ColumnLabelRfNode = Node<ColumnLabelData, 'columnLabel'>

export function ColumnLabelNode({ data }: NodeProps<ColumnLabelRfNode>) {
  return (
    <div className="pointer-events-none w-[250px] select-none rounded-lg border border-slate-600 bg-slate-800/95 px-2.5 py-2 shadow-md">
      <div className="text-xs font-medium text-slate-200">{data.title}</div>
      <div className="font-mono text-[10px] text-slate-500">{data.slug}</div>
    </div>
  )
}
