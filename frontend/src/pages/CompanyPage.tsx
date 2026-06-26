import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useWorkspaceStore } from '../hooks/useWorkspaceStore'

type CompanyMemberRole = 'owner' | 'admin' | 'member' | 'viewer'

type CompanyMember = {
  id: string
  email: string
  fullName: string
  position: string
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
  about: 'Карточка компании и список сотрудников. Данные хранятся на сервере для вашей учётной записи.',
  members: [],
  updatedAt: new Date(0).toISOString(),
}

function makeId(): string {
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
              fullName: typeof m.fullName === 'string' ? m.fullName : '',
              position: typeof m.position === 'string' ? m.position : '',
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
  const legacyStorageKey = useMemo(() => (user ? `near_company_v1_${user.id}` : null), [user])

  const {
    data: company,
    setData: setCompany,
    loading,
    dirty,
    savedAt,
    error,
    saving,
    save,
    reset,
  } = useWorkspaceStore<CompanyProfile>({
    storeKey: 'company',
    defaultValue: DEFAULT_COMPANY,
    legacyStorageKey,
    parseLegacy: safeParseCompany,
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [invitePosition, setInvitePosition] = useState('')
  const [inviteRole, setInviteRole] = useState<CompanyMemberRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !user || company.members.length > 0) return
    setCompany({
      ...company,
      members: [
        {
          id: makeId(),
          email: normalizeEmail(user.email),
          fullName: '',
          position: '',
          role: 'owner',
          addedAt: new Date().toISOString(),
        },
      ],
    })
  }, [loading, user, company, setCompany])

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
    setCompany({
      ...company,
      members: [
        ...company.members,
        {
          id: makeId(),
          email,
          fullName: inviteFullName.trim(),
          position: invitePosition.trim(),
          role: inviteRole,
          addedAt: new Date().toISOString(),
        },
      ],
    })
    setInviteEmail('')
    setInviteFullName('')
    setInvitePosition('')
    setInviteRole('member')
  }

  const updateMember = (id: string, patch: Partial<Pick<CompanyMember, 'fullName' | 'position' | 'role'>>) => {
    setCompany({
      ...company,
      members: company.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })
  }

  const removeMember = (id: string) => {
    const target = company.members.find((m) => m.id === id)
    if (target?.role === 'owner') {
      setInviteError('Нельзя удалить владельца')
      return
    }
    setCompany({ ...company, members: company.members.filter((m) => m.id !== id) })
  }

  const handleSave = () => {
    void save()
  }

  const handleReset = () => {
    void reset()
  }

  if (loading) {
    return <p className="text-slate-500">Загрузка…</p>
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
            Карточка компании и сотрудники сохраняются на сервере для вашей учётной записи.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {savedAt ? <p className="mt-2 text-xs text-slate-500">Сохранено: {new Date(savedAt).toLocaleString()}</p> : null}
      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold text-white/90">Карточка</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs text-slate-400">Название</span>
              <input
                value={company.name}
                onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Сайт</span>
              <input
                value={company.website}
                onChange={(e) => setCompany((c) => ({ ...c, website: e.target.value }))}
                placeholder="https://"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Описание</span>
              <textarea
                value={company.about}
                onChange={(e) => setCompany((c) => ({ ...c, about: e.target.value }))}
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

          <div className="mt-4 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="ФИО"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
              <input
                value={invitePosition}
                onChange={(e) => setInvitePosition(e.target.value)}
                placeholder="Должность"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr,160px,auto]">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email"
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
          </div>

          {inviteError ? <p className="mt-2 text-xs text-amber-200/90">{inviteError}</p> : null}

          <div className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800">
            {company.members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-start gap-3 bg-slate-950/30 px-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={m.fullName}
                      onChange={(e) => updateMember(m.id, { fullName: e.target.value })}
                      placeholder="ФИО"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                    />
                    <input
                      value={m.position}
                      onChange={(e) => updateMember(m.id, { position: e.target.value })}
                      placeholder="Должность"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div className="truncate text-xs text-slate-500">{m.email}</div>
                  <div className="text-xs text-slate-600">
                    Добавлен: {new Date(m.addedAt).toLocaleDateString()}
                  </div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => updateMember(m.id, { role: e.target.value as CompanyMemberRole })}
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
        </section>
      </div>
    </div>
  )
}
