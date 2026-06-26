import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { acceptProjectInvite, projectRoleLabel } from '../api/projectMembers'
import { useAuth } from '../context/AuthContext'
import { emitProjectsChanged } from '../nearEvents'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { token: authToken, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const accept = useCallback(async () => {
    if (!authToken || !token) return
    setError(null)
    try {
      await acceptProjectInvite(authToken, token)
      setDone(true)
      emitProjectsChanged()
      window.setTimeout(() => navigate('/projects/carousel', { replace: true }), 1500)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось принять приглашение')
    }
  }, [authToken, token, logout, navigate])

  useEffect(() => {
    if (authToken && token) void accept()
  }, [authToken, token, accept])

  if (!token) {
    return <p className="text-slate-400">Некорректная ссылка приглашения.</p>
  }

  if (!authToken) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Приглашение в проект</h1>
        <p className="mt-3 text-sm text-slate-400">Войдите в аккаунт, чтобы принять приглашение.</p>
        <Link to={`/login?next=/invites/${token}`} className="near-btn-primary mt-6 inline-block">
          Войти
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold text-white">Приглашение в проект</h1>
      {done ? (
        <p className="mt-3 text-sm text-emerald-300">Приглашение принято. Переход к проектам…</p>
      ) : error ? (
        <>
          <p className="near-alert-warn mt-4">{error}</p>
          <button type="button" onClick={() => void accept()} className="near-btn-secondary mt-4">
            Повторить
          </button>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Принимаем приглашение…</p>
      )}
      <p className="mt-6 text-xs text-slate-600">
        После входа вам будет назначена роль: {projectRoleLabel('editor')} или{' '}
        {projectRoleLabel('viewer')} (как указал владелец).
      </p>
    </div>
  )
}
