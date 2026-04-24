import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

type CompanyMemberRole = 'owner' | 'admin' | 'member' | 'viewer'

type CompanyMember = {
  id: string
  email: string
  role: CompanyMemberRole
  addedAt: string
}

type CompanyProfile = {
  name: string
  website: string
  about: string
  members: CompanyMember[]
  updatedAt: string
}

const DEFAULT_COMPANY: CompanyProfile = {
  name: 'Near Demo Company',
  website: '',
  about: 'Это локальная карточка компании (MVP). Данные сохраняются в браузере и не уходят на сервер.',
  members: [],
  updatedAt: new Date(0).toISOString(),
}

function makeId(): string {
  // Нужен простой уникальный id без зависимостей.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function roleLabel(role: CompanyMemberRole): string {
  switch (role) {
    case 'owner':
      return 'Владелец'
    case 'admin':
      return 'Администратор'
    case 'member':
      return 'Участник'
    case 'viewer':
      return 'Наблюдатель'
  }
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function safeParseCompany(raw: string | null): CompanyProfile | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<CompanyProfile> | null
    if (!v || typeof v !== 'object') return null
    return {
      name: typeof v.name === 'string' ? v.name : DEFAULT_COMPANY.name,
      website: typeof v.website === 'string' ? v.website : DEFAULT_COMPANY.website,
      about: typeof v.about === 'string' ? v.about : DEFAULT_COMPANY.about,
      members: Array.isArray(v.members)
        ? v.members
            .filter((m): m is CompanyMember => !!m && typeof m === 'object')
            .map((m) => ({
              id: typeof m.id === 'string' ? m.id : makeId(),
              email: typeof m.email === 'string' ? m.email : '',
              role: (m.role === 'owner' || m.role === 'admin' || m.role === 'member' || m.role === 'viewer'
                ? m.role
                : 'member') as CompanyMemberRole,
              addedAt: typeof m.addedAt === 'string' ? m.addedAt : new Date().toISOString(),
            }))
            .filter((m) => m.email.length > 0)
        : DEFAULT_COMPANY.members,
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : DEFAULT_COMPANY.updatedAt,
    }
  } catch {
    return null
  }
}

export function CompanyPage() {
  const { user } = useAuth()

  const storageKey = useMemo(() => (user ? `near_company_v1_${user.id}` : null), [user])

  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CompanyMemberRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!storageKey) return
    const loaded = safeParseCompany(localStorage.getItem(storageKey))
    const base = loaded ?? DEFAULT_COMPANY

    // Автодобавляем текущего пользователя как owner (локально), если список пуст.
    if (user && base.members.length === 0) {
      setCompany({
        ...base,
        members: [
          {
            id: makeId(),
            email: normalizeEmail(user.email),
            role: 'owner',
            addedAt: new Date().toISOString(),
          },
        ],
      })
      setDirty(true)
      return
    }

    setCompany(base)
    setDirty(false)
    setSavedAt(null)
  }, [storageKey, user])

  const save = () => {
    if (!storageKey) return
    const next: CompanyProfile = { ...company, updatedAt: new Date().toISOString() }
    localStorage.setItem(storageKey, JSON.stringify(next))
    setCompany(next)
    setDirty(false)
    setSavedAt(next.updatedAt)
  }

  const resetLocal = () => {
    if (!storageKey) return
    localStorage.removeItem(storageKey)
    setCompany(DEFAULT_COMPANY)
    setDirty(true)
    setSavedAt(null)
  }

  const addMember = () => {
    setInviteError(null)
    const email = normalizeEmail(inviteEmail)
    if (!email || !email.includes('@')) {
      setInviteError('Введите корректный email')
      return
    }
    if (company.members.some((m) => normalizeEmail(m.email) === email)) {
      setInviteError('Этот email уже есть в списке')
      return
    }
    const next: CompanyProfile = {
      ...company,
      members: [
        ...company.members,
        {
          id: makeId(),
          email,
          role: inviteRole,
          addedAt: new Date().toISOString(),
        },
      ],
    }
    setCompany(next)
    setInviteEmail('')
    setInviteRole('member')
    setDirty(true)
  }

  const updateRole = (id: string, role: CompanyMemberRole) => {
    const next: CompanyProfile = {
      ...company,
      members: company.members.map((m) => (m.id === id ? { ...m, role } : m)),
    }
    setCompany(next)
    setDirty(true)
  }

  const removeMember = (id: string) => {
    const target = company.members.find((m) => m.id === id)
    if (target?.role === 'owner') {
      setInviteError('Нельзя удалить владельца (MVP-ограничение)')
      return
    }
    const next: CompanyProfile = { ...company, members: company.members.filter((m) => m.id !== id) }
    setCompany(next)
    setDirty(true)
  }

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Моя компания</h1>
          <p className="mt-1 text-sm text-slate-400">
            Пока это <span className="text-slate-300">локальный MVP</span>: данные сохраняются в браузере для вашей учётки.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetLocal}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Сбросить локально
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </div>

      {savedAt ? <p className="mt-2 text-xs text-slate-500">Сохранено: {new Date(savedAt).toLocaleString()}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold text-white/90">Карточка</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs text-slate-400">Название</span>
              <input
                value={company.name}
                onChange={(e) => {
                  setCompany((c) => ({ ...c, name: e.target.value }))
                  setDirty(true)
                }}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Сайт</span>
              <input
                value={company.website}
                onChange={(e) => {
                  setCompany((c) => ({ ...c, website: e.target.value }))
                  setDirty(true)
                }}
                placeholder="https://"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Описание</span>
              <textarea
                value={company.about}
                onChange={(e) => {
                  setCompany((c) => ({ ...c, about: e.target.value }))
                  setDirty(true)
                }}
                rows={5}
                className="mt-1 w-full resize-none rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">Сотрудники</h2>
            <span className="text-xs text-slate-500">{company.members.length}</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr,160px,auto]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email сотрудника"
              className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as CompanyMemberRole)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
            >
              <option value="admin">Администратор</option>
              <option value="member">Участник</option>
              <option value="viewer">Наблюдатель</option>
            </select>
            <button
              type="button"
              onClick={addMember}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
            >
              Добавить
            </button>
          </div>

          {inviteError ? <p className="mt-2 text-xs text-amber-200/90">{inviteError}</p> : null}

          <div className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
            {company.members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 bg-slate-950/30 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white/90">{m.email}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Добавлен: {new Date(m.addedAt).toLocaleDateString()}
                  </div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => updateRole(m.id, e.target.value as CompanyMemberRole)}
                  disabled={m.role === 'owner'}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60 disabled:opacity-60"
                >
                  <option value="owner">{roleLabel('owner')}</option>
                  <option value="admin">{roleLabel('admin')}</option>
                  <option value="member">{roleLabel('member')}</option>
                  <option value="viewer">{roleLabel('viewer')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  Удалить
                </button>
              </div>
            ))}
            {company.members.length === 0 ? (
              <div className="bg-slate-950/30 px-3 py-6 text-center text-sm text-slate-400">
                Добавьте первого сотрудника.
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-slate-600">
            Подключим backend позже: команды/приглашения/роли сейчас сохраняются только локально.
          </p>
        </section>
      </div>
    </div>
  )
}

