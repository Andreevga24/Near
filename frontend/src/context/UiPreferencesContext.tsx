import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { translate, type Locale, type MessageKey, type Theme } from '../i18n/messages'

const LOCALE_KEY = 'near_locale_v1'
const THEME_KEY = 'near_theme_v1'

type UiPreferencesContextValue = {
  locale: Locale
  theme: Theme
  setLocale: (locale: Locale) => void
  setTheme: (theme: Theme) => void
  t: (key: MessageKey) => string
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null)

function readLocale(): Locale {
  if (typeof window === 'undefined') return 'ru'
  return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'ru'
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(LOCALE_KEY, next)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    localStorage.setItem(THEME_KEY, next)
    applyTheme(next)
  }, [])

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale])

  const value = useMemo(
    () => ({ locale, theme, setLocale, setTheme, t }),
    [locale, theme, setLocale, setTheme, t],
  )

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext)
  if (!ctx) throw new Error('useUiPreferences must be used within UiPreferencesProvider')
  return ctx
}
