/**
 * Форма регистрации: POST /register с JSON { email, password }.
 */

import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, formatApiError, loginUser, registerUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setPending(true)
    try {
      await registerUser(email.trim(), password)
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
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-violet-950/20 backdrop-blur">
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight text-white">
          Регистрация в Near
        </h1>
        <p className="mb-8 text-center text-sm text-slate-400">
          Создайте аккаунт для доступа к проектам
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="block text-left text-sm font-medium text-slate-300">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-violet-500/40 focus:border-violet-500 focus:ring-2"
            />
          </label>
          <label className="block text-left text-sm font-medium text-slate-300">
            Пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-violet-500/40 focus:border-violet-500 focus:ring-2"
            />
          </label>
          <label className="block text-left text-sm font-medium text-slate-300">
            Повтор пароля
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-violet-500/40 focus:border-violet-500 focus:ring-2"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {pending ? 'Создание…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-violet-400 hover:text-violet-300">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
