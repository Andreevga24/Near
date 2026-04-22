import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, formatApiError } from '../api/auth'
import { fetchKindPreset, saveKindPreset, type KindPreset } from '../api/presets'
import { PROJECT_KIND_LABEL, PROJECT_KIND_VALUES, type ProjectKind } from '../constants/projectKinds'
import { useAuth } from '../context/AuthContext'

function prettyJson(v: unknown): string {
  return JSON.stringify(v, null, 2)
}

export function PresetEditorPage() {
  const { token, logout } = useAuth()
  const [kind, setKind] = useState<ProjectKind>('general')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [columnHintsText, setColumnHintsText] = useState('{}')
  const [checklistsText, setChecklistsText] = useState('{}')

  const kindLabel = useMemo(() => PROJECT_KIND_LABEL[kind], [kind])

  useEffect(() => {
    if (!token) return
    setError(null)
    setOk(null)
    setLoading(true)
    ;(async () => {
      try {
        const p = await fetchKindPreset(token, kind)
        setColumnHintsText(prettyJson(p.column_hints ?? {}))
        setChecklistsText(prettyJson(p.default_checklists ?? {}))
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          logout()
          return
        }
        setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить пресет')
      } finally {
        setLoading(false)
      }
    })()
  }, [token, kind, logout])

  async function onSave() {
    if (!token) return
    setError(null)
    setOk(null)
    setSaving(true)
    try {
      const column_hints = JSON.parse(columnHintsText || '{}') as KindPreset['column_hints']
      const default_checklists = JSON.parse(checklistsText || '{}') as KindPreset['default_checklists']
      const saved = await saveKindPreset(token, kind, { column_hints, default_checklists })
      setColumnHintsText(prettyJson(saved.column_hints ?? {}))
      setChecklistsText(prettyJson(saved.default_checklists ?? {}))
      setOk('Сохранено.')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось сохранить пресет (проверьте JSON)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/settings" className="text-sm text-slate-500 hover:text-slate-300">
        ← Настройки
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white">Редактор пресетов</h1>
      <p className="mt-2 text-sm text-slate-500">
        Переопределение подсказок колонок и дефолтных чеклистов для <span className="font-mono">project.kind</span>.
      </p>

      {ok ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <label className="block text-sm">
          <span className="text-slate-500">Сценарий (kind)</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProjectKind)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
          >
            {PROJECT_KIND_VALUES.map((k) => (
              <option key={k} value={k}>
                {PROJECT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">Текущий: {kindLabel}</p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-medium text-slate-300">Подсказки колонок</h2>
          <p className="mt-1 text-xs text-slate-500">JSON: статус → подсказка</p>
          <textarea
            value={columnHintsText}
            onChange={(e) => setColumnHintsText(e.target.value)}
            className="mt-3 h-80 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
            spellCheck={false}
          />
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-medium text-slate-300">Дефолтные чеклисты</h2>
          <p className="mt-1 text-xs text-slate-500">JSON: статус → массив пунктов</p>
          <textarea
            value={checklistsText}
            onChange={(e) => setChecklistsText(e.target.value)}
            className="mt-3 h-80 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-500"
            spellCheck={false}
          />
        </section>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {loading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}
      </div>
    </div>
  )
}

