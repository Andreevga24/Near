import { Outlet } from 'react-router-dom'

import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
