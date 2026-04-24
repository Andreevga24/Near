/**
 * Форма входа: OAuth2-совместимый POST /login.
 */

import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, formatApiError, loginUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const { access_token } = await loginUser(email.trim(), password)
      setToken(access_token)
      navigate('/projects/carousel', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err.body) : String(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="near-app-bg mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="near-card-lg">
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight text-white">Вход в Near</h1>
        <p className="mb-8 text-center text-sm text-slate-400">Управление проектами и канбан-досками</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="block text-left text-sm font-medium text-slate-300">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="near-input mt-1 py-2.5"
            />
          </label>
          <label className="block text-left text-sm font-medium text-slate-300">
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="near-input mt-1 py-2.5"
            />
          </label>

          {error ? (
            <p className="near-alert-error">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="near-btn-primary mt-2 py-2.5"
          >
            {pending ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Нет аккаунта?{' '}
          <Link to="/register" className="near-link font-medium">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  )
}
