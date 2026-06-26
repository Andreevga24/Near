/**
 * Компактная верхняя полоса: навигация перенесена в левую панель {@link AppSidebar}.
 */

import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useUiPreferences } from '../context/UiPreferencesContext'
import { NotificationBell } from './NotificationBell'

export function AppHeader() {
  const { user } = useAuth()
  const { t } = useUiPreferences()

  if (!user) {
    return null
  }

  return (
    <header className="near-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
        <Link to="/" className="text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-300">
          {t('nav.home')}
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-white/5 sm:inline"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          >
            {t('search.hint')} · Ctrl+K
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
