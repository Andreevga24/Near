/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL FastAPI (без завершающего /). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
