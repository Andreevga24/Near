/**
 * Компактная верхняя полоса: навигация перенесена в левую панель {@link AppSidebar}.
 */

import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function AppHeader() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
        <Link to="/" className="text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-400">
          На главную
        </Link>
      </div>
    </header>
  )
}
