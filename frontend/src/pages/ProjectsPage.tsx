/**
 * Список проектов пользователя и создание нового.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { createProject, deleteProject, listProjects, type Project } from '../api/projects'
import { useAuth } from '../context/AuthContext'

export function ProjectsPage() {
  const { token, logout } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setError(null)
    setLoading(true)
    try {
      const list = await listProjects(token)
      setProjects(list)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить проекты')
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const p = await createProject(token, {
        name: name.trim(),
        description: description.trim() || null,
      })
      setProjects((prev) => [p, ...prev])
      setName('')
      setDescription('')
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

  async function handleDelete(id: string, title: string) {
    if (!token) return
    if (!window.confirm(`Удалить проект «${title}» и все задачи?`)) return
    setError(null)
    try {
      await deleteProject(token, id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Ошибка удаления')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Мои проекты</h1>
      <p className="mt-2 text-slate-400">
        Создайте проект и откройте канбан-доску задач.
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
        <h2 className="text-sm font-medium text-slate-300">Новый проект</h2>
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
      </form>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-slate-400">Все проекты</h2>
        {loading ? (
          <p className="mt-4 text-slate-500">Загрузка…</p>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-slate-500">Пока нет проектов — создайте первый выше.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <div>
                  <Link
                    to={`/projects/${p.id}`}
                    className="font-medium text-violet-300 hover:text-violet-200"
                  >
                    {p.name}
                  </Link>
                  {p.description ? (
                    <p className="mt-1 max-w-xl text-sm text-slate-500">{p.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/projects/${p.id}`}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Доска
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id, p.name)}
                    className="rounded-md border border-red-900/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
