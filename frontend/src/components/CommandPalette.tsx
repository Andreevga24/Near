import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { globalSearch } from '../api/search'
import { useAuth } from '../context/AuthContext'
import { useUiPreferences } from '../context/UiPreferencesContext'

export function CommandPalette() {
  const { token, logout } = useAuth()
  const { t } = useUiPreferences()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Awaited<ReturnType<typeof globalSearch>> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setError(null)
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open || !token) return
    const q = query.trim()
    if (q.length < 1) {
      setResults(null)
      return
    }
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void globalSearch(token, q)
        .then(setResults)
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            logout()
            return
          }
          setError(e instanceof ApiError ? formatApiError(e.body) : 'Search failed')
        })
        .finally(() => setLoading(false))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [open, query, token, logout])

  const goProject = useCallback(
    (id: string) => {
      setOpen(false)
      navigate(`/projects/${id}`)
    },
    [navigate],
  )

  const goTask = useCallback(
    (projectId: string) => {
      setOpen(false)
      navigate(`/projects/${projectId}`)
    },
    [navigate],
  )

  if (!open) return null

  const empty = results && results.projects.length === 0 && results.tasks.length === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-[12vh]">
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t('search.hint')}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full border-b border-slate-800 bg-transparent px-4 py-3 text-sm text-slate-100 outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? <p className="px-3 py-2 text-sm text-slate-500">{t('common.loading')}</p> : null}
          {error ? <p className="px-3 py-2 text-sm text-amber-200">{error}</p> : null}
          {empty ? <p className="px-3 py-2 text-sm text-slate-500">{t('search.noResults')}</p> : null}
          {results && results.projects.length > 0 ? (
            <div className="mb-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('search.projects')}
              </p>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goProject(p.id)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          {results && results.tasks.length > 0 ? (
            <div>
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('search.tasks')}
              </p>
              {results.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => goTask(task.project_id)}
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                >
                  <div className="text-sm text-slate-200">{task.title}</div>
                  <div className="text-xs text-slate-500">
                    {task.project_name} · {task.status}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-600">Ctrl+K · Esc</p>
      </div>
    </div>
  )
}
