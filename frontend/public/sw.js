/* Minimal Service Worker for Near.
 * - Caches app shell assets so the UI can open offline.
 * - Does NOT cache /api calls (we keep API network-first).
 */

const CACHE_NAME = 'near-shell-v1'

// These are "app shell" files that exist in both dev/prod.
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(SHELL_URLS)
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
      self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle same-origin GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Never cache API calls
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  // Cache-first for static assets
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        // Cache successful responses for same-origin assets
        if (res.ok) {
          cache.put(req, res.clone())
        }
        return res
      } catch {
        // Offline fallback for navigations
        if (req.mode === 'navigate') {
          return (await cache.match('/')) || (await cache.match('/index.html'))
        }
        throw
      }
    })(),
  )
})

