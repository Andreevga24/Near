/**
 * Форма регистрации с согласием на обработку ПДн (152-ФЗ).
 */

import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, formatApiError, loginUser, registerUser } from '../api/auth'
import { fetchLegalMeta, type LegalMeta } from '../api/legal'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const { setToken } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [meta, setMeta] = useState<LegalMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void fetchLegalMeta()
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!accepted) {
      setError('Необходимо принять политику конфиденциальности и пользовательское соглашение')
      return
    }
    if (!meta) {
      setError('Не удалось загрузить версии юридических документов. Попробуйте позже.')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setPending(true)
    try {
      await registerUser(email.trim(), password, {
        accept_privacy: true,
        accept_terms: true,
        privacy_version: meta.privacy_version,
        terms_version: meta.terms_version,
      })
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
        <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight text-white">Регистрация в Near</h1>
        <p className="mb-8 text-center text-sm text-slate-400">Создайте аккаунт для доступа к проектам</p>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="near-input mt-1 py-2.5"
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
              className="near-input mt-1 py-2.5"
            />
          </label>

          <label className="flex items-start gap-2 text-left text-sm text-slate-400">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1"
            />
            <span>
              Я принимаю{' '}
              <Link to="/legal/privacy" target="_blank" className="near-link">
                политику конфиденциальности
              </Link>
              ,{' '}
              <Link to="/legal/terms" target="_blank" className="near-link">
                пользовательское соглашение
              </Link>{' '}
              и даю{' '}
              <Link to="/legal/consent" target="_blank" className="near-link">
                согласие на обработку персональных данных
              </Link>
              . Мне исполнилось 18 лет или я действую от имени организации.
            </span>
          </label>

          {error ? <p className="near-alert-error">{error}</p> : null}

          <button type="submit" disabled={pending || !accepted} className="near-btn-primary mt-2 py-2.5">
            {pending ? 'Создание…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="near-link font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
