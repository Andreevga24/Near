/**
 * Настройки профиля: смена email и пароля.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { patchCurrentUser } from '../api/profile'
import { useAuth } from '../context/AuthContext'

export function ProfileSettingsPage() {
  const { token, user, refreshUser } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [msgOk, setMsgOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  if (!user) {
    return (
      <div className="near-card px-4 py-8 text-center text-slate-400">
        Загрузка профиля…
      </div>
    )
  }
  const me = user

  const emailTrim = newEmail.trim().toLowerCase()
  const emailDirty = emailTrim.length > 0 && emailTrim !== me.email.toLowerCase()

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    const next = newEmail.trim().toLowerCase()
    if (!token || !next || next === me.email.toLowerCase()) return
    setSavingEmail(true)
    setError(null)
    setMsgOk(null)
    try {
      await patchCurrentUser(token, { email: next })
      setNewEmail('')
      await refreshUser()
      setMsgOk('Email обновлён.')
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось сохранить email')
    } finally {
      setSavingEmail(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    if (password.length < 3) {
      setError('Пароль слишком короткий')
      return
    }
    setSavingPass(true)
    setError(null)
    setMsgOk(null)
    try {
      await patchCurrentUser(token, { password })
      setPassword('')
      setPassword2('')
      setMsgOk('Пароль изменён.')
    } catch (err) {
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось сменить пароль')
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div>
      <Link to="/projects/carousel" className="near-link-muted">
        ← Проекты
      </Link>
      <h1 className="near-h1 mt-2">Профиль и настройки</h1>
      <p className="near-lead">Управление email и паролем учётной записи Near.</p>

      <div className="mt-4">
        <Link
          to="/settings/presets"
          className="near-btn-secondary"
        >
          Редактор пресетов →
        </Link>
      </div>

      {msgOk ? (
        <p className="near-alert-ok mt-4">{msgOk}</p>
      ) : null}
      {error ? (
        <p className="near-alert-warn mt-4">{error}</p>
      ) : null}

      <section className="near-card mt-10">
        <h2 className="text-sm font-medium text-slate-300">Текущий аккаунт</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-mono text-slate-200">{me.email}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-slate-500">Id</dt>
            <dd className="font-mono text-xs text-slate-400">{me.id}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-slate-500">Регистрация</dt>
            <dd className="text-slate-300">{new Date(me.created_at).toLocaleString()}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-slate-500">Статус</dt>
            <dd className="text-slate-300">
              {me.is_active ? 'активен' : 'неактивен'}
              {me.is_verified ? ', email подтверждён' : ''}
              {me.is_superuser ? ', администратор' : ''}
            </dd>
          </div>
        </dl>
      </section>

      <section className="near-card mt-8">
        <h2 className="text-sm font-medium text-slate-300">Сменить email</h2>
        <form onSubmit={saveEmail} className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-slate-500">Новый email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="near-input mt-1"
              placeholder={me.email}
            />
          </label>
          <button
            type="submit"
            disabled={savingEmail || !emailDirty}
            className="near-btn-primary disabled:opacity-40"
          >
            {savingEmail ? 'Сохранение…' : 'Сохранить email'}
          </button>
        </form>
      </section>

      <section className="near-card mt-8">
        <h2 className="text-sm font-medium text-slate-300">Сменить пароль</h2>
        <p className="mt-1 text-xs text-slate-500">Минимум 3 символа (для dev; в проде задайте политику сильнее).</p>
        <form onSubmit={savePassword} className="mt-4 max-w-md space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500">Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="near-input mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Повтор пароля</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="near-input mt-1"
            />
          </label>
          <button
            type="submit"
            disabled={savingPass || !password}
            className="near-btn-primary disabled:opacity-40"
          >
            {savingPass ? 'Сохранение…' : 'Обновить пароль'}
          </button>
        </form>
      </section>
    </div>
  )
}
