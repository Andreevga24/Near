import { useCallback, useEffect, useState } from 'react'

import { ApiError, formatApiError } from '../api/auth'
import {
  deleteWorkspaceStore,
  readWorkspaceStore,
  saveWorkspaceStore,
  type WorkspaceStoreKey,
} from '../api/workspace'
import { useAuth } from '../context/AuthContext'

type UseWorkspaceStoreOptions<T> = {
  storeKey: WorkspaceStoreKey
  defaultValue: T
  legacyStorageKey: string | null
  parseLegacy: (raw: string | null) => T | null
}

export function useWorkspaceStore<T extends Record<string, unknown>>({
  storeKey,
  defaultValue,
  legacyStorageKey,
  parseLegacy,
}: UseWorkspaceStoreOptions<T>) {
  const { token, logout } = useAuth()
  const [data, setData] = useState<T>(defaultValue)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const remote = await readWorkspaceStore<T>(token, storeKey)
      if (remote.data && Object.keys(remote.data).length > 0) {
        setData(remote.data)
        setDirty(false)
        setSavedAt(remote.updated_at)
        return
      }

      if (legacyStorageKey && typeof window !== 'undefined') {
        const legacy = parseLegacy(localStorage.getItem(legacyStorageKey))
        if (legacy) {
          const saved = await saveWorkspaceStore(token, storeKey, legacy)
          localStorage.removeItem(legacyStorageKey)
          setData(legacy)
          setDirty(false)
          setSavedAt(saved.updated_at)
          return
        }
      }

      setData(defaultValue)
      setDirty(false)
      setSavedAt(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }, [token, storeKey, defaultValue, legacyStorageKey, parseLegacy, logout])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveWorkspaceStore(token, storeKey, data)
      setDirty(false)
      setSavedAt(saved.updated_at)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }, [token, storeKey, data, logout])

  const reset = useCallback(async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      await deleteWorkspaceStore(token, storeKey)
      if (legacyStorageKey && typeof window !== 'undefined') {
        localStorage.removeItem(legacyStorageKey)
      }
      setData(defaultValue)
      setDirty(true)
      setSavedAt(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
        return
      }
      setError(e instanceof ApiError ? formatApiError(e.body) : 'Не удалось сбросить')
    } finally {
      setSaving(false)
    }
  }, [token, storeKey, defaultValue, legacyStorageKey, logout])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setData((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next))
    setDirty(true)
  }, [])

  return {
    data,
    setData: update,
    loading,
    dirty,
    savedAt,
    error,
    setError,
    saving,
    save,
    reset,
    reload: load,
  }
}
