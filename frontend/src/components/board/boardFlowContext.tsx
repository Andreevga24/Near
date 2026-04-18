import { createContext, useContext, type ReactNode } from 'react'

import type { FlowExtras } from './boardFlowTypes'

const BoardFlowExtrasContext = createContext<null | (() => FlowExtras)>(null)

export function BoardFlowExtrasProvider({
  getExtras,
  children,
}: {
  getExtras: () => FlowExtras
  children: ReactNode
}) {
  return (
    <BoardFlowExtrasContext.Provider value={getExtras}>{children}</BoardFlowExtrasContext.Provider>
  )
}

export function useBoardFlowExtras(): FlowExtras {
  const get = useContext(BoardFlowExtrasContext)
  if (!get) {
    throw new Error('useBoardFlowExtras: нет провайдера')
  }
  return get()
}
