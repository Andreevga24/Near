/**
 * Создание нового проекта (список — на странице карусели /projects/carousel).
 */

import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { createProject } from '../api/projects'
import {
  DEFAULT_PROJECT_KIND,
  labelProjectKind,
  PROJECT_KIND_VALUES,
  type ProjectKind,
} from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'
import { emitProjectsChanged } from '../nearEvents'

export function ProjectsPage() {
  const { token, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<ProjectKind>(DEFAULT_PROJECT_KIND)
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!token || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createProject(token, {
        name: name.trim(),
        description: description.trim() || null,
        kind,
      })
      emitProjectsChanged()
      setName('')
      setDescription('')
      setKind(DEFAULT_PROJECT_KIND)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link
        to="/projects/carousel"
        className="text-sm text-violet-400 hover:text-violet-300"
      >
        ← К карусели проектов
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white">Новый проект</h1>
      <p className="mt-2 text-slate-400">
        Выберите тип — от него зависят колонки на доске. Список и открытие досок — в{' '}
        <Link to="/projects/carousel" className="text-violet-400 hover:text-violet-300">
          карусели проектов
        </Link>
        .
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
      >
        <h2 className="text-sm font-medium text-slate-300">Данные проекта</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-slate-500">Название</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
              placeholder="Например, Маркетинг Q2"
              maxLength={255}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? 'Создание…' : 'Создать'}
          </button>
        </div>
        <label className="mt-3 block text-sm">
          <span className="text-slate-500">Описание (необязательно)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
            placeholder="Кратко о целях проекта"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-slate-500">Тип проекта (сценарий доски)</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProjectKind)}
            className="mt-1 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
          >
            {PROJECT_KIND_VALUES.map((k) => (
              <option key={k} value={k}>
                {labelProjectKind(k)}
              </option>
            ))}
          </select>
        </label>
      </form>
    </div>
  )
}
