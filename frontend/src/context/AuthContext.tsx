/**
 * Контекст авторизации: JWT в localStorage, профиль с /me.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { ApiError, fetchMe, type UserMe } from '../api/auth'

const STORAGE_KEY = 'near_access_token'

type AuthContextValue = {
  token: string | null
  user: UserMe | null
  loading: boolean
  setToken: (t: string | null) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)

  const setToken = useCallback((t: string | null) => {
    setTokenState(t)
    if (t) {
      localStorage.setItem(STORAGE_KEY, t)
      // Пока /me не ответит, user ещё null — иначе RequireAuth и редиректы видят «нет сессии».
      setLoading(true)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      setUser(null)
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [setToken])

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe(token)
      setUser(me)
    } catch (e) {
      setUser(null)
      // Не сбрасываем токен при сетевых/503 сбоях — только при явной потере авторизации
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setToken(null)
      }
    } finally {
      setLoading(false)
    }
  }, [token, setToken])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setToken,
      logout,
      refreshUser,
    }),
    [token, user, loading, setToken, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
