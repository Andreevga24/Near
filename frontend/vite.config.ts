import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // По умолчанию на Windows Vite может слушать только ::1 (IPv6); Firefox по адресу 127.0.0.1
    // тогда не подключается. Явный IPv4-loopback исправляет это.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Снижает риск, что Firefox покажет старый index/модули из кэша после правок в коде.
    headers: {
      'Cache-Control': 'no-store',
    },
    // Запросы на /api/* уходят на FastAPI — тот же origin, что и страница (нет CORS в dev).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') || '/',
      },
    },
  },
})
