/**
 * DeepSeek Harness Service Worker
 *
 * Three-layer cache strategy:
 *   1. Shell — pre-cached on install (HTML entry + entry JS/CSS chunks)
 *   2. Static — cache-first for /assets/* with background revalidation
 *   3. API — network-first, never serve stale data
 *
 * Statistics are tracked per-layer and exposed to the client via
 * postMessage so the app can report cache-hit ratios.
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

// ── Cache-hit statistics ────────────────────────────────────────────────

/** @type {{ shellHits: number, staticHits: number, staticMisses: number, navFallbacks: number, errors: number, installTime: number }} */
const stats = {
  shellHits: 0,      // pre-cached shell assets served
  staticHits: 0,     // cache-first assets served from cache
  staticMisses: 0,   // cache-first assets fetched online then cached
  navFallbacks: 0,   // navigation requests fell back to cache or offline page
  errors: 0,         // fetch failures not served from cache
  installTime: 0,    // epoch ms of the activating install
}

/** Track a hit/miss event. */
function recordHit(layer) {
  if (layer === 'shell') stats.shellHits++
  else if (layer === 'static') stats.staticHits++
  else if (layer === 'static-miss') stats.staticMisses++
  else if (layer === 'nav-fallback') stats.navFallbacks++
  else if (layer === 'error') stats.errors++
}

/** Answer a cache-stats query from the client. */
function getStatsReport() {
  const total = stats.shellHits + stats.staticHits + stats.staticMisses
  return {
    ...stats,
    totalStaticRequests: stats.staticHits + stats.staticMisses,
    hitRate: total > 0 ? ((stats.shellHits + stats.staticHits) / total * 100).toFixed(1) : '0.0',
    uptime: stats.installTime > 0 ? Date.now() - stats.installTime : 0,
  }
}

// ── Offline fallback page ───────────────────────────────────────────────

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
  body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;background:#f5f5f5;color:#333;transition:background .3s,color .3s}
  @media(prefers-color-scheme:dark){body{background:#171717;color:#e5e5e5}}
  .card{text-align:center;padding:2rem;max-width:28rem}
  .icon{font-size:3rem;margin-bottom:1rem;line-height:1}
  h1{font-size:1.25rem;font-weight:500;margin-bottom:.5rem}
  p{color:#666;font-size:.875rem;line-height:1.5;margin-bottom:1.5rem}
  @media(prefers-color-scheme:dark){p{color:#999}}
  .btn{display:inline-block;padding:.5rem 1.25rem;font-size:.875rem;font-weight:500;color:#fff;background:#2563eb;border:none;border-radius:.5rem;cursor:pointer;text-decoration:none;transition:background .2s}
  .btn:hover{background:#1d4ed8}
  .btn:active{background:#1e40af}
  .status{font-size:.75rem;color:#888;margin-top:1rem}
  @media(prefers-color-scheme:dark){.status{color:#666}}
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#x1F4E1;</div>
  <h1>No Connection</h1>
  <p>You&rsquo;re offline. Your work is safe — cached pages and assets are still available.</p>
  <button class="btn" onclick="window.location.reload()" aria-live="polite">Try Again</button>
  <div class="status" id="status">Checking connection&hellip;</div>
</div>
<script>
  // Auto-reconnect polling — when the network returns, reload.
  var attempts = 0
  var maxAttempts = 300 // ~5 minutes at 1 s intervals
  var timer = setInterval(function check() {
    attempts++
    fetch('./', { method: 'HEAD', cache: 'no-store' })
      .then(function(r) {
        if (r.ok) {
          clearInterval(timer)
          document.getElementById('status').textContent = 'Connection restored! Reloading&hellip;'
          setTimeout(function() { window.location.reload() }, 800)
        }
      })
      .catch(function() {
        document.getElementById('status').textContent =
          'Checking connection&hellip; (' + attempts + ')'
      })
    if (attempts >= maxAttempts) clearInterval(timer)
  }, 1000)
</script>
</body>
</html>`

// ── Install: pre-cache shell ────────────────────────────────────────────

self.addEventListener('install', event => {
  stats.installTime = Date.now()
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

// ── Message: respond to client queries ──────────────────────────────────

self.addEventListener('message', event => {
  const { type } = event.data || {}
  if (type === 'DSH_CACHE_STATS') {
    const report = getStatsReport()
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(report)
    } else if (event.source) {
      event.source.postMessage({ type: 'DSH_CACHE_STATS_REPLY', stats: report })
    }
  }
  if (type === 'DSH_SKIP_WAITING') {
    self.skipWaiting()
  }
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

  // Static assets: cache-first.  Content-addressed URLs (build hashes,
  // plugin revisions) skip background revalidation — the URL *is* the
  // version, so a re-fetch can only return identical bytes.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstHandler(request, !isContentAddressed(url)))
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
    if (cached) {
      recordHit('shell')
      return cached
    }
    const shell = await caches.match('/index.html')
    if (shell) {
      recordHit('shell')
      return shell
    }
    recordHit('nav-fallback')
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
}

/**
 * Static assets: serve from cache immediately.  When `revalidate` is set,
 * refresh the cache in the background for the next visit; content-addressed
 * URLs pass false and keep the cached bytes as-is.
 *
 * @param {Request} request
 * @param {boolean} revalidate
 */
async function cacheFirstHandler(request, revalidate) {
  const cached = await caches.match(request)
  if (cached) {
    recordHit('static')
    if (revalidate) {
      // Background revalidation — silently refresh the cache.
      fetch(request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response))
        }
      }).catch(() => { /* offline — keep the cached copy */ })
    }
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) {
      recordHit('static-miss')
      const cache = await caches.open(CACHE_NAME)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      cache.put(request, response.clone())
    }
    return response
  } catch {
    recordHit('error')
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

/** API / other: network-only; let the application handle failures. */
async function networkOnlyHandler(request) {
  return fetch(request)
}

/** Returns true when `url` should be served cache-first. */
function isStaticAsset(url) {
  const { pathname, search } = url
  if (STATIC_PATTERNS.some(p => p.test(pathname))) return true
  // Runtime plugin bundles: combo URLs carry the whole file list in the
  // query (`/plugins/??a/client.js,b/client.js&rev=x`), so their pathname
  // is bare `/plugins/` and pattern-matching on it alone never fires.
  // The rev query pins content, making cache-first safe.  The
  // /plugins/events stream has a distinct pathname and no .js payload,
  // so it stays network-only.
  return pathname.startsWith('/plugins/') && (search.includes('.js') || pathname.endsWith('.js'))
}

/**
 * Content-addressed URLs never change in place: Vite build hashes under
 * /assets/ and rev-pinned plugin bundles.  A cache hit needs no background
 * revalidation — re-fetching identical bytes only wastes mobile data.
 */
function isContentAddressed(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/plugins/')
}