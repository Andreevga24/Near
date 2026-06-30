/**
 * Базовый URL backend API.
 *
 * В режиме `npm run dev` по умолчанию `/api` — Vite проксирует на `http://127.0.0.1:8002`
 * (см. `vite.config.ts`), поэтому не нужен открытый CORS и не путаются localhost / 127.0.0.1.
 *
 * В production по умолчанию `/api` (тот же origin через reverse proxy).
 * Задайте VITE_API_BASE_URL, если API на другом хосте.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '/api'
