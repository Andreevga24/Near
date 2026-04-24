import { Outlet } from 'react-router-dom'

import { AppFooter } from './AppFooter'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export function AppLayout() {
  return (
    <div className="near-app-bg flex min-h-screen">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 overflow-auto px-4 py-8">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
