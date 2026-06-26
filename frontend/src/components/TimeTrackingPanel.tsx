import { useCallback, useEffect, useState } from 'react'

import { fetchActiveTimer, formatDuration, startTimer, stopTimer, type TimeEntry } from '../api/time'

type Props = {
  token: string
  taskId: string
  canEdit: boolean
}

export function TimeTrackingPanel({ token, taskId, canEdit }: Props) {
  const [active, setActive] = useState<TimeEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const reload = useCallback(async () => {
    try {
      const entry = await fetchActiveTimer(token)
      setActive(entry)
    } catch {
      setActive(null)
    }
  }, [token])

  useEffect(() => {
    void reload()
  }, [reload, taskId])

  const isThisTask = active?.task_id === taskId && !active?.stopped_at

  useEffect(() => {
    if (!isThisTask || !active) {
      setElapsed(0)
      return
    }
    const startMs = new Date(active.started_at).getTime()
    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [isThisTask, active])

  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      const entry = await startTimer(token, taskId)
      setActive(entry)
    } catch {
      setError('Не удалось запустить таймер')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    setError(null)
    try {
      await stopTimer(token)
      setActive(null)
    } catch {
      setError('Не удалось остановить таймер')
    } finally {
      setLoading(false)
    }
  }

  if (!canEdit) return null

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Учёт времени</p>
      {error ? <p className="mt-1 text-xs text-amber-300">{error}</p> : null}
      {isThisTask ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-emerald-400">{formatDuration(elapsed)}</span>
          <span className="text-xs text-slate-500">идёт запись…</span>
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={loading}
            className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            Стоп
          </button>
        </div>
      ) : active && !active.stopped_at ? (
        <div className="mt-2">
          <p className="text-xs text-slate-500">
            Активен таймер на «{active.task_title ?? 'другой задаче'}». Запуск здесь остановит его.
          </p>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={loading}
            className="near-btn-secondary mt-2 text-xs disabled:opacity-50"
          >
            Старт на этой задаче
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={loading}
          className="near-btn-secondary mt-2 text-xs disabled:opacity-50"
        >
          Старт
        </button>
      )}
    </div>
  )
}
