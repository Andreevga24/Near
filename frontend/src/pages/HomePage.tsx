/**
 * Главная: состояние авторизации и ссылки на формы.
 */

import { Link } from 'react-router-dom'

import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'

export function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-slate-400">
        Загрузка…
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm uppercase tracking-widest text-violet-400">Near</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Добро пожаловать</h1>
          <p className="mt-4 text-slate-400">
            Вы вошли как <span className="font-mono text-slate-200">{user.email}</span>
          </p>
          <p className="mt-2 text-xs text-slate-600">id: {user.id}</p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              to="/projects"
              className="inline-flex rounded-lg bg-violet-600 px-6 py-3 text-sm font-medium text-white hover:bg-violet-500"
            >
              Мои проекты и доски
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-sm uppercase tracking-widest text-violet-400">Near</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Управление проектами</h1>
      <p className="mt-4 text-slate-400">
        Войдите или зарегистрируйтесь, чтобы работать с проектами и досками задач.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          to="/login"
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          Вход
        </Link>
        <Link
          to="/register"
          className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Регистрация
        </Link>
      </div>
    </div>
  )
}
