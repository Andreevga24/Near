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
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-slate-400">
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
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← Проекты
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white">Профиль и настройки</h1>
      <p className="mt-2 text-sm text-slate-500">
        Управление email и паролем учётной записи Near.
      </p>

      {msgOk ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {msgOk}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-medium text-slate-300">Сменить email</h2>
        <form onSubmit={saveEmail} className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-slate-500">Новый email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
              placeholder={me.email}
            />
          </label>
          <button
            type="submit"
            disabled={savingEmail || !emailDirty}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {savingEmail ? 'Сохранение…' : 'Сохранить email'}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Повтор пароля</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
            />
          </label>
          <button
            type="submit"
            disabled={savingPass || !password}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {savingPass ? 'Сохранение…' : 'Обновить пароль'}
          </button>
        </form>
      </section>
    </div>
  )
}
