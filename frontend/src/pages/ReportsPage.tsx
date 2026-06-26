import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { listProjects, type Project } from '../api/projects'
import {
  downloadReportsExport,
  fetchReportsDashboard,
  fetchReportsSummary,
  formatDuration,
  type ReportsDashboard,
  type ReportsSummary,
} from '../api/reports'
import { fetchTimeReport } from '../api/time'
import { useAuth } from '../context/AuthContext'

function fmtInt(n: number): string {
  return new Intl.NumberFormat().format(n)
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('готов') || s.includes('закры')) return 'bg-emerald-500/80'
  if (s.includes('progress') || s.includes('doing') || s.includes('в работ')) return 'bg-violet-500/80'
  if (s.includes('review') || s.includes('проверк')) return 'bg-amber-500/80'
  if (s.includes('blocked') || s.includes('block') || s.includes('стоп')) return 'bg-red-500/80'
  return 'bg-slate-500/80'
}

export function ReportsPage() {
  const { token, logout } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null)
  const [timeTotal, setTimeTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)
  const [projectFilter, setProjectFilter] = useState<string>('all')

  const load = useCallback(async () => {
    if (!token) return
    setError(null)
    setLoading(true)
    try {
      const ps = await listProjects(token)
      setProjects(ps)
      const pid = projectFilter === 'all' ? undefined : projectFilter
      const [s, d, tr] = await Promise.all([
        fetchReportsSummary(token, pid),
        fetchReportsDashboard(token, pid),
        fetchTimeReport(token, pid, 30),
      ])
      setSummary(s)
      setDashboard(d)
      setTimeTotal(tr.total_seconds)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить отчёты')
    } finally {
      setLoading(false)
    }
  }, [token, logout, projectFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!token) return
    setExporting(format)
    try {
      const pid = projectFilter === 'all' ? undefined : projectFilter
      await downloadReportsExport(token, format, pid)
    } catch {
      setError('Не удалось экспортировать отчёт')
    } finally {
      setExporting(null)
    }
  }

  const selectedProjectName = useMemo(() => {
    if (projectFilter === 'all') return 'Все проекты'
    return projects.find((p) => p.id === projectFilter)?.name ?? 'Проект'
  }, [projects, projectFilter])

  const total = summary?.active_total ?? 0
  const doneLike = useMemo(() => {
    if (!summary) return 0
    return summary.by_status
      .filter((s) => {
        const l = s.status.toLowerCase()
        return l.includes('done') || l.includes('готов')
      })
      .reduce((a, s) => a + s.count, 0)
  }, [summary])

  const completion = total > 0 ? clamp01(doneLike / total) : 0
  const maxBurndownClosed = Math.max(1, ...(dashboard?.burndown.map((p) => p.closed_count) ?? [1]))

  return (
    <div>
      <Link to="/projects/carousel" className="text-sm text-slate-500 hover:text-slate-300">
        ← К проектам
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Отчёты и дашборд</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Сводка, burn-down, задачи в работе, просрочки по исполнителям, учёт времени, экспорт CSV/PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
          >
            <option value="all">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exporting !== null}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {exporting === 'csv' ? '…' : 'CSV'}
          </button>
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exporting !== null}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
          >
            {exporting === 'pdf' ? '…' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Обновить
          </button>
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
          <Link to="/projects" className="text-violet-400 hover:text-violet-300">
            создайте первый
          </Link>
          .
        </p>
      ) : summary && dashboard ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{selectedProjectName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Активных: {fmtInt(total)} · в архиве: {fmtInt(summary.archived_total)} · время (30 дн.):{' '}
                  {formatDuration(timeTotal || dashboard.time_total_seconds)}
                </div>
              </div>
              <div className="w-full max-w-sm">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Готово (по статусу)</span>
                  <span>{Math.round(completion * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-emerald-500/80" style={{ width: `${Math.round(completion * 100)}%` }} />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Активные</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(total)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">В архиве</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(summary.archived_total)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Закрыто за 7 дн.</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(summary.closed_last_7_days)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Закрыто за 30 дн.</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(summary.closed_last_30_days)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Просрочено</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(summary.overdue)}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xs text-slate-500">Дедлайн ≤ 7 дн.</div>
              <div className="mt-2 text-2xl font-semibold text-white">{fmtInt(summary.due_soon)}</div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="text-sm font-semibold text-white/90">Burn-down (закрыто по дням, 14 дн.)</div>
            <div className="mt-4 flex h-32 items-end gap-1">
              {dashboard.burndown.map((p) => (
                <div key={p.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(4, (p.closed_count / maxBurndownClosed) * 100)}%` }}
                    title={`${p.date}: закрыто ${p.closed_count}, осталось ${p.remaining_active}`}
                  />
                  <span className="text-[9px] text-slate-600">{p.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-sm font-semibold text-white/90">В работе (не финальные статусы)</div>
              <div className="mt-4 space-y-2">
                {dashboard.in_progress.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет задач в работе.</p>
                ) : (
                  dashboard.in_progress.map((s) => (
                    <div key={s.status} className="flex justify-between text-sm">
                      <span className="text-slate-300">{s.status}</span>
                      <span className="tabular-nums text-white/85">{s.count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-sm font-semibold text-white/90">Просрочки по исполнителям</div>
              <div className="mt-4 space-y-2">
                {dashboard.overdue_by_assignee.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет данных.</p>
                ) : (
                  dashboard.overdue_by_assignee.slice(0, 12).map((a, i) => (
                    <div key={a.assignee_id ?? `u-${i}`} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-slate-300">{a.assignee_email ?? 'Без исполнителя'}</span>
                      <span className="shrink-0 text-slate-500">
                        проср. {a.overdue_count} · в работе {a.in_progress_count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {summary.by_project.length > 0 ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-sm font-semibold text-white/90">По проектам</div>
              <div className="mt-4 space-y-2">
                {summary.by_project.map((p) => (
                  <div key={p.project_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{p.project_name}</span>
                    <span className="text-slate-500">
                      активных {p.active_total} · архив {p.archived_total}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="border-b border-white/10 px-5 py-3">
              <div className="text-sm font-semibold text-white/90">По статусам (активные)</div>
            </div>
            <div className="p-5">
              {summary.by_status.length === 0 ? (
                <p className="text-sm text-slate-500">Нет активных задач.</p>
              ) : (
                <div className="space-y-3">
                  {summary.by_status.slice(0, 12).map((s) => {
                    const p = total > 0 ? (s.count / total) * 100 : 0
                    return (
                      <div key={s.status} className="grid grid-cols-[1fr,64px] items-center gap-3">
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="truncate text-sm text-white/90">{s.status}</div>
                            <div className="text-xs text-slate-500">{Math.round(p)}%</div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full ${statusColor(s.status)}`} style={{ width: `${Math.max(2, Math.round(p))}%` }} />
                          </div>
                        </div>
                        <div className="text-right text-sm tabular-nums text-white/85">{fmtInt(s.count)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
