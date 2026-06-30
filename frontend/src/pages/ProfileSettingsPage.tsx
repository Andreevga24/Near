/**
 * Настройки профиля: личные данные, email и пароль.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { deleteAccount, downloadAccountExport } from '../api/legal'
import { patchCurrentUser } from '../api/profile'
import { useAuth } from '../context/AuthContext'
import { useUiPreferences } from '../context/UiPreferencesContext'
import { useWorkspaceStore } from '../hooks/useWorkspaceStore'

type UserProfileData = {
  fullName: string
  position: string
  phone: string
  about: string
  updatedAt: string
}

const DEFAULT_PROFILE: UserProfileData = {
  fullName: '',
  position: '',
  phone: '',
  about: '',
  updatedAt: new Date(0).toISOString(),
}

function initialsFromProfile(email: string, fullName: string): string {
  const name = fullName.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const local = email.split('@')[0] ?? '?'
  return local.slice(0, 2).toUpperCase()
}

function formatPhoneInput(raw: string): string {
  return raw.replace(/[^\d+\-() ]/g, '').slice(0, 24)
}

export function ProfileSettingsPage() {
  const { token, user, refreshUser, logout } = useAuth()
  const { locale, theme, setLocale, setTheme, t } = useUiPreferences()

  const {
    data: profile,
    setData: setProfile,
    loading: profileLoading,
    dirty: profileDirty,
    savedAt: profileSavedAt,
    error: profileStoreError,
    saving: profileSaving,
    save: saveProfile,
  } = useWorkspaceStore<UserProfileData>({
    storeKey: 'profile',
    defaultValue: DEFAULT_PROFILE,
    legacyStorageKey: null,
    parseLegacy: () => null,
  })

  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [passMsg, setPassMsg] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passError, setPassError] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [showId, setShowId] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const navigate = useNavigate()

  const displayName = useMemo(() => {
    const name = profile.fullName.trim()
    return name || user?.email || 'Профиль'
  }, [profile.fullName, user?.email])

  if (!user) {
    return (
      <div className="near-card px-4 py-8 text-center text-slate-400">
        Загрузка профиля…
      </div>
    )
  }

  const emailTrim = newEmail.trim().toLowerCase()
  const emailDirty = emailTrim.length > 0 && emailTrim !== user.email.toLowerCase()

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !user) return
    const next = newEmail.trim().toLowerCase()
    if (!next || next === user.email.toLowerCase()) return
    setSavingEmail(true)
    setEmailError(null)
    setEmailMsg(null)
    try {
      await patchCurrentUser(token, { email: next })
      setNewEmail('')
      await refreshUser()
      setEmailMsg('Email обновлён.')
    } catch (err) {
      setEmailError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось сохранить email')
    } finally {
      setSavingEmail(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== password2) {
      setPassError('Пароли не совпадают')
      return
    }
    if (password.length < 8) {
      setPassError('Пароль должен быть не короче 8 символов')
      return
    }
    setSavingPass(true)
    setPassError(null)
    setPassMsg(null)
    try {
      await patchCurrentUser(token, { password })
      setPassword('')
      setPassword2('')
      setPassMsg('Пароль изменён.')
    } catch (err) {
      setPassError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось сменить пароль')
    } finally {
      setSavingPass(false)
    }
  }

  const handleSaveProfile = () => {
    void saveProfile()
  }

  return (
    <div>
      <Link to="/projects/carousel" className="near-link-muted">
        ← Проекты
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/90 text-xl font-semibold text-white">
          {initialsFromProfile(user.email, profile.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="near-h1">{displayName}</h1>
          <p className="near-lead mt-1">{user.email}</p>
          {profile.position.trim() ? (
            <p className="mt-1 text-sm text-slate-400">{profile.position.trim()}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/settings/presets" className="near-btn-secondary text-sm">
          Редактор пресетов
        </Link>
        <Link to="/workspace/company" className="near-btn-secondary text-sm">
          Моя компания
        </Link>
      </div>

      <section className="near-card mt-8 max-w-xl">
        <h2 className="text-sm font-semibold text-white/90">{t('settings.appearance')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">{t('settings.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'ru' | 'en')}
              className="near-input mt-1"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t('settings.theme')}</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
              className="near-input mt-1"
            >
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
            </select>
          </label>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="near-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-300">Личные данные</h2>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={!profileDirty || profileSaving || profileLoading}
              className="near-btn-primary text-sm disabled:opacity-40"
            >
              {profileSaving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ФИО и контакты хранятся на сервере и видны только вам.
          </p>

          {profileLoading ? (
            <p className="mt-4 text-sm text-slate-500">Загрузка…</p>
          ) : (
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500">ФИО</span>
                <input
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  className="near-input mt-1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Должность</span>
                <input
                  value={profile.position}
                  onChange={(e) => setProfile((p) => ({ ...p, position: e.target.value }))}
                  placeholder="Например, руководитель проекта"
                  className="near-input mt-1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Телефон</span>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
                  placeholder="+7 …"
                  className="near-input mt-1"
                  inputMode="tel"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">О себе</span>
                <textarea
                  value={profile.about}
                  onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value }))}
                  rows={4}
                  placeholder="Кратко о роли и зоне ответственности"
                  className="near-input mt-1 resize-none"
                />
              </label>
            </div>
          )}

          {profileSavedAt ? (
            <p className="mt-3 text-xs text-slate-500">
              Сохранено: {new Date(profileSavedAt).toLocaleString()}
            </p>
          ) : null}
          {profileStoreError ? (
            <p className="near-alert-warn mt-3">{profileStoreError}</p>
          ) : null}
        </section>

        <section className="near-card">
          <h2 className="text-sm font-medium text-slate-300">Аккаунт</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Email для входа</dt>
              <dd className="mt-0.5 font-mono text-slate-200">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Регистрация</dt>
              <dd className="mt-0.5 text-slate-300">{new Date(user.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Статус</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                  {user.is_active ? 'Активен' : 'Неактивен'}
                </span>
                {user.is_verified ? (
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs text-sky-300">
                    Email подтверждён
                  </span>
                ) : null}
                {user.is_superuser ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-200">
                    Администратор
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Идентификатор</dt>
              <dd className="mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowId((v) => !v)}
                  className="text-xs text-slate-500 underline decoration-slate-600 hover:text-slate-300"
                >
                  {showId ? 'Скрыть' : 'Показать'} UUID
                </button>
                {showId ? (
                  <p className="mt-1 break-all font-mono text-xs text-slate-400">{user.id}</p>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="near-card mt-8 max-w-xl">
        <h2 className="text-sm font-semibold text-white/90">{t('settings.appearance')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">{t('settings.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'ru' | 'en')}
              className="near-input mt-1"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t('settings.theme')}</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
              className="near-input mt-1"
            >
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="light">{t('settings.themeLight')}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="near-card mt-8">
        <h2 className="text-sm font-medium text-slate-300">Сменить email</h2>
        <form onSubmit={saveEmail} className="mt-4 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-slate-500">Новый email</span>
            <input
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="near-input mt-1"
              placeholder={user.email}
            />
          </label>
          <button
            type="submit"
            disabled={savingEmail || !emailDirty}
            className="near-btn-primary disabled:opacity-40"
          >
            {savingEmail ? 'Сохранение…' : 'Обновить email'}
          </button>
        </form>
        {emailMsg ? <p className="near-alert-ok mt-3">{emailMsg}</p> : null}
        {emailError ? <p className="near-alert-warn mt-3">{emailError}</p> : null}
      </section>

      <section className="near-card mt-8">
        <h2 className="text-sm font-medium text-slate-300">Сменить пароль</h2>
        <p className="mt-1 text-xs text-slate-500">Минимум 8 символов, как при регистрации.</p>
        <form onSubmit={savePassword} className="mt-4 max-w-lg space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500">Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
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
              minLength={8}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="near-input mt-1"
            />
          </label>
          <button
            type="submit"
            disabled={savingPass || password.length < 8}
            className="near-btn-primary disabled:opacity-40"
          >
            {savingPass ? 'Сохранение…' : 'Обновить пароль'}
          </button>
        </form>
        {passMsg ? <p className="near-alert-ok mt-3">{passMsg}</p> : null}
        {passError ? <p className="near-alert-warn mt-3">{passError}</p> : null}
      </section>

      <section className="near-card mt-8 max-w-xl">
        <h2 className="text-sm font-semibold text-white/90">Персональные данные</h2>
        <p className="mt-2 text-xs text-slate-500">
          Права субъекта ПДн (152-ФЗ): экспорт и удаление аккаунта. Документы:{' '}
          <Link to="/legal/privacy" className="near-link">
            политика
          </Link>
          ,{' '}
          <Link to="/legal/terms" className="near-link">
            соглашение
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!token || exporting}
            onClick={() => {
              if (!token) return
              setExportMsg(null)
              setExporting(true)
              void downloadAccountExport(token)
                .then(() => setExportMsg('Файл экспорта загружен'))
                .catch(() => setExportMsg('Не удалось экспортировать данные'))
                .finally(() => setExporting(false))
            }}
            className="near-btn-secondary text-sm disabled:opacity-40"
          >
            {exporting ? 'Экспорт…' : 'Скачать мои данные (JSON)'}
          </button>
        </div>
        {exportMsg ? <p className="near-alert-ok mt-3 text-sm">{exportMsg}</p> : null}

        <div className="mt-6 border-t border-slate-800 pt-6">
          <h3 className="text-sm font-medium text-red-300">Удаление аккаунта</h3>
          <p className="mt-1 text-xs text-slate-500">
            Безвозвратно удалит аккаунт, проекты, где вы владелец, и связанные данные.
          </p>
          <div className="mt-4 space-y-3 max-w-lg">
            <label className="block text-sm">
              <span className="text-slate-500">Пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="near-input mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Введите DELETE для подтверждения</span>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="near-input mt-1 font-mono text-sm"
                placeholder="DELETE"
              />
            </label>
            <button
              type="button"
              disabled={!token || deleting || deleteConfirm.toUpperCase() !== 'DELETE' || !deletePassword}
              onClick={() => {
                if (!token) return
                setDeleteError(null)
                setDeleting(true)
                void deleteAccount(token, deletePassword)
                  .then(() => {
                    logout()
                    navigate('/', { replace: true })
                  })
                  .catch((e: unknown) => {
                    setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить аккаунт')
                  })
                  .finally(() => setDeleting(false))
              }}
              className="rounded-lg bg-red-900/80 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-900 disabled:opacity-40"
            >
              {deleting ? 'Удаление…' : 'Удалить аккаунт навсегда'}
            </button>
          </div>
          {deleteError ? <p className="near-alert-warn mt-3 text-sm">{deleteError}</p> : null}
        </div>
      </section>
    </div>
  )
}
