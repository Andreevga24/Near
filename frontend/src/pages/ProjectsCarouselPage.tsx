/**
 * Проекты в виде горизонтальной карусели карточек.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import {
  deleteProject,
  disableProjectShare,
  enableProjectShare,
  listProjects,
  type Project,
  type ProjectShare,
} from '../api/projects'
import { badgeProjectKind, labelProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'
import { emitProjectsChanged } from '../nearEvents'

const CARD_STEP = 340

export function ProjectsCarouselPage() {
  const { token, logout } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [shareByProject, setShareByProject] = useState<Record<string, ProjectShare | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

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

  const scrollByDir = useCallback((dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * CARD_STEP, behavior: 'smooth' })
  }, [])

  const publicUrlForShareId = useCallback((sid: string) => {
    if (typeof window === 'undefined') return `/public/${sid}`
    return `${window.location.origin}/public/${sid}`
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }, [])

  async function handleEnableShare(projectId: string) {
    if (!token) return
    setError(null)
    try {
      const share = await enableProjectShare(token, projectId)
      setShareByProject((prev) => ({ ...prev, [projectId]: share }))
      if (share.share_id) {
        await copyToClipboard(publicUrlForShareId(share.share_id))
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось включить публичную ссылку')
    }
  }

  async function handleDisableShare(projectId: string) {
    if (!token) return
    setError(null)
    try {
      const share = await disableProjectShare(token, projectId)
      setShareByProject((prev) => ({ ...prev, [projectId]: share }))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof ApiError ? formatApiError(err.body) : 'Не удалось выключить публичную ссылку')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!token) return
    if (!window.confirm(`Удалить проект «${title}» и все задачи?`)) return
    setError(null)
    try {
      await deleteProject(token, id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
      emitProjectsChanged()
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-300">
            ← Новый проект
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Проекты</h1>
          <p className="mt-2 max-w-xl text-slate-400">
            Листайте карточки стрелками или жестом. Откройте доску или удалите проект.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-slate-500">Загрузка…</p>
      ) : projects.length === 0 ? (
        <p className="mt-10 text-slate-500">
          Пока нет проектов —{' '}
          <Link to="/projects" className="near-link">
            создайте первый
          </Link>
          .
        </p>
      ) : (
        <div className="relative mt-10">
          <button
            type="button"
            aria-label="Предыдущие проекты"
            onClick={() => scrollByDir(-1)}
            className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900/95 text-lg text-slate-200 shadow-lg hover:bg-slate-800 md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Следующие проекты"
            onClick={() => scrollByDir(1)}
            className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-700 bg-slate-900/95 text-lg text-slate-200 shadow-lg hover:bg-slate-800 md:flex"
          >
            ›
          </button>

          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-1 pb-4 pt-2 md:px-14 [scrollbar-width:thin]"
          >
            {projects.map((p) => (
              <article
                key={p.id}
                className="snap-center shrink-0 select-none"
                style={{ width: 'min(88vw, 300px)' }}
              >
                <div className="flex h-full min-h-[220px] flex-col rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5 shadow-lg shadow-black/20 backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-snug text-white">{p.name}</h2>
                    <span className="near-badge shrink-0 border-0 bg-slate-700/80 text-white">
                      {badgeProjectKind(p.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{labelProjectKind(p.kind)}</p>
                  {p.description ? (
                    <p className="mt-3 line-clamp-4 flex-1 text-sm text-slate-400">{p.description}</p>
                  ) : (
                    <p className="mt-3 flex-1 text-sm italic text-slate-600">Без описания</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
                    <Link
                      to={`/projects/${p.id}`}
                      className="near-btn-primary"
                    >
                      Доска
                    </Link>
                    {shareByProject[p.id]?.enabled ? (
                      <>
                        <a
                          href={
                            shareByProject[p.id]?.share_id
                              ? publicUrlForShareId(shareByProject[p.id]!.share_id!)
                              : '#'
                          }
                          onClick={(e) => {
                            if (!shareByProject[p.id]?.share_id) return
                            e.preventDefault()
                            void copyToClipboard(publicUrlForShareId(shareByProject[p.id]!.share_id!))
                          }}
                          className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/40"
                          title="Скопировать публичную ссылку"
                        >
                          Публичная ссылка
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDisableShare(p.id)}
                          className="near-btn-secondary"
                        >
                          Выключить
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleEnableShare(p.id)}
                        className="near-btn-secondary"
                        title="Включить и скопировать ссылку"
                      >
                        Публичная ссылка
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id, p.name)}
                      className="near-btn-danger"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
