/**
 * Базовый URL backend API.
 *
 * В режиме `npm run dev` по умолчанию `/api` — Vite проксирует на `http://127.0.0.1:8000`
 * (см. `vite.config.ts`), поэтому не нужен открытый CORS и не путаются localhost / 127.0.0.1.
 *
 * Явно задайте VITE_API_BASE_URL, если API на другом хосте или для `vite preview`/прод.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:8000')
