/**
 * Верхняя панель для авторизованных экранов: бренд, проекты, выход.
 */

import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function AppHeader() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) {
    return null
  }

  const onProjects = location.pathname.startsWith('/projects')

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-sm font-semibold tracking-tight text-violet-300 hover:text-violet-200">
          Near
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            to="/projects"
            className={
              onProjects
                ? 'rounded-md bg-violet-600/30 px-3 py-1.5 text-violet-100'
                : 'rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white'
            }
          >
            Проекты
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
          >
            Выйти
          </button>
        </nav>
      </div>
    </header>
  )
}
