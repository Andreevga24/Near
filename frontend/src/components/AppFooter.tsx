import { Link } from 'react-router-dom'

export function AppFooter() {
  return (
    <footer className="border-t border-slate-900/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800/70 bg-slate-950/40 text-sm font-semibold text-white backdrop-blur">
            N
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Near</div>
            <div className="text-xs text-slate-500">Сделано для быстрых итераций продукта.</div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/" className="text-slate-400 hover:text-slate-200">
            Главная
          </Link>
          <Link to="/projects/carousel" className="text-slate-400 hover:text-slate-200">
            Проекты
          </Link>
          <Link to="/workspace/feed" className="text-slate-400 hover:text-slate-200">
            Лента
          </Link>
          <Link to="/workspace/support" className="text-slate-400 hover:text-slate-200">
            Поддержка
          </Link>
        </nav>

        <div className="text-xs text-slate-500">© {new Date().getFullYear()} Near</div>
      </div>
    </footer>
  )
}

