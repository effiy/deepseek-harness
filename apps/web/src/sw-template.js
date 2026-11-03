/**
 * DeepSeek Harness Service Worker
 *
 * Three-layer cache strategy:
 *   1. Shell — pre-cached on install (HTML entry + entry JS chunks)
 *   2. Static — cache-first for /assets/* with background revalidation
 *   3. API/other — network-first, no stale cache
 *
 * Placeholders __CACHE_VERSION__ and __SHELL_ASSETS__ are replaced at
 * build time by the dsh-generate-sw Vite plugin.
 *
 * @generated — edit sw-template.js, not this file.
 */

const CACHE_VERSION = '__CACHE_VERSION__'
const CACHE_NAME = `dsh-${CACHE_VERSION}`

/** Shell asset URLs to pre-cache on install (injected at build time). */
const SHELL_ASSETS = __SHELL_ASSETS__

/** Pathname patterns served cache-first. */
const STATIC_PATTERNS = [/^\/assets\//, /\.(?:svg|png|jpe?g|webp|woff2?|webmanifest|ico)$/]

/** Minimal offline fallback page served when nothing is cached. */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" media="(prefers-color-scheme:light)" content="#f5f5f5">
<meta name="theme-color" media="(prefers-color-scheme:dark)" content="#171717">
<title>Offline — DeepSeek Harness</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;background:#f5f5f5;color:#333}
  @media(prefers-color-scheme:dark){body{background:#171717;color:#e5e5e5}}
  .card{text-align:center;padding:2rem;max-width:24rem}
  .icon{font-size:3rem;margin-bottom:1rem}
  h1{font-size:1.25rem;font-weight:500;margin-bottom:.5rem}
  p{color:#666;font-size:.875rem;line-height:1.5}
  @media(prefers-color-scheme:dark){p{color:#999}}
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#x1F4E1;</div>
  <h1>No Connection</h1>
  <p>You&rsquo;re offline. Check your network and try again.</p>
</div>
</body>
</html>`

// ── Install: pre-cache shell ────────────────────────────────────────────

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_ASSETS).catch(err => {
        // A single missing URL must not block the install.
        console.warn('[DSH SW] pre-cache partial failure:', err.message)
      })
    ),
  )
})

// ── Activate: clean old caches, claim clients ───────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

// ── Fetch: routing by request type ──────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests.
  if (url.origin !== self.location.origin) return
  if (request.method !== 'GET') return

  // Navigation: network-first with cached shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(navigateHandler(request))
    return
  }

  // Static assets: cache-first with background revalidation.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstHandler(request))
    return
  }

  // API / other: network-first, never serve stale data.
  event.respondWith(networkOnlyHandler(request))
})

// ── Handlers ────────────────────────────────────────────────────────────

/**
 * Navigation requests: try network first; fall back through cached HTML
 * to the built-in offline page.
 */
async function navigateHandler(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const ct = response.headers.get('content-type') ?? ''
      if (ct.includes('text/html')) {
        const cache = await caches.open(CACHE_NAME)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        cache.put(request, response.clone())
      }
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const shell = await caches.match('/index.html')
    if (shell) return shell
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
}

/**
 * Static assets: serve from cache immediately; revalidate in background
 * for the next visit.
 */
async function cacheFirstHandler(request) {
  const cached = await caches.match(request)
  if (cached) {
    // Background revalidation — silently refresh the cache.
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response))
      }
    }).catch(() => { /* offline — keep the cached copy */ })
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

/** API / other: network-only; let the application handle failures. */
async function networkOnlyHandler(request) {
  return fetch(request)
}

/** Returns true when `pathname` matches a static-asset pattern. */
function isStaticAsset(pathname) {
  return STATIC_PATTERNS.some(p => p.test(pathname))
}