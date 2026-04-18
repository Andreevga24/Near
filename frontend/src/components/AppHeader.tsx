import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

const navCls =
  'rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white'
const navActive = 'bg-slate-800 text-white'

export function AppHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/" className="text-sm font-semibold tracking-wide text-violet-400">
            Near
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/projects" end className={({ isActive }) => `${navCls} ${isActive ? navActive : ''}`}>
              Проекты
            </NavLink>
          </nav>
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
            >
              Выйти
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
