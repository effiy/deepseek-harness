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

/** @type {{ shellHits: number, staticHits: number, staticMisses: number, staticErrors: number, navTotal: number, navNetworkOk: number, navFromShell: number, navFromOffline: number, apiRequests: number, apiErrors: number, installTime: number, lastResetTime: number }} */
const stats = {
  // Layer 1: Shell pre-cache
  shellHits: 0,         // navigation or asset served from pre-cached shell

  // Layer 2: Static cache-first
  staticHits: 0,        // /assets/* or static file served from cache
  staticMisses: 0,      // cache miss → fetched online → cached
  staticErrors: 0,      // cache miss AND network failed (503 response)

  // Navigation breakdown
  navTotal: 0,          // total navigation (mode=navigate) requests
  navNetworkOk: 0,      // served fresh from network
  navFromShell: 0,      // network down → served cached /index.html
  navFromOffline: 0,    // even cached shell missing → offline fallback page

  // Layer 3: API (network-only / network-first)
  apiRequests: 0,       // total API requests forwarded to the network
  apiErrors: 0,         // API requests that threw (offline) — app handles these

  // Metadata
  installTime: 0,       // epoch ms of the latest install
  lastResetTime: 0,     // epoch ms of the last stats reset (0 = never)
}

/** Track a hit/miss event. */
function recordHit(layer) {
  if (layer === 'shell') stats.shellHits++
  else if (layer === 'static') stats.staticHits++
  else if (layer === 'static-miss') stats.staticMisses++
  else if (layer === 'static-error') stats.staticErrors++
  else if (layer === 'nav-total') stats.navTotal++
  else if (layer === 'nav-network') stats.navNetworkOk++
  else if (layer === 'nav-shell') stats.navFromShell++
  else if (layer === 'nav-offline') stats.navFromOffline++
  else if (layer === 'api-request') stats.apiRequests++
  else if (layer === 'api-error') stats.apiErrors++
}

/** Estimate the total bytes stored in the named cache. */
async function estimateCacheSize() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    let total = 0
    for (const req of keys) {
      const resp = await cache.match(req)
      if (resp) {
        const blob = await resp.clone().blob()
        total += blob.size
      }
    }
    return total
  } catch {
    return -1 // unavailable (e.g. cache deleted during scan)
  }
}

/** Count the number of entries in the named cache. */
async function countCacheEntries() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    return keys.length
  } catch {
    return -1
  }
}

/** Answer a cache-stats query from the client (lightweight, synchronous). */
function getStatsReport() {
  const staticTotal = stats.staticHits + stats.staticMisses
  // Shell hits come from navigation fallbacks to cached /index.html —
  // these are valid cache hits, not misses.
  const cacheHits = stats.shellHits + stats.staticHits + stats.navFromShell
  const allCacheable = cacheHits + stats.staticMisses
  return {
    shellHits: stats.shellHits,
    staticHits: stats.staticHits,
    staticMisses: stats.staticMisses,
    staticErrors: stats.staticErrors,
    navTotal: stats.navTotal,
    navNetworkOk: stats.navNetworkOk,
    navFromShell: stats.navFromShell,
    navFromOffline: stats.navFromOffline,
    apiRequests: stats.apiRequests,
    apiErrors: stats.apiErrors,
    installTime: stats.installTime,
    lastResetTime: stats.lastResetTime,
    staticHitRate: staticTotal > 0 ? ((stats.staticHits / staticTotal) * 100).toFixed(1) : '0.0',
    overallHitRate: allCacheable > 0 ? ((cacheHits / allCacheable) * 100).toFixed(1) : '0.0',
    uptime: stats.installTime > 0 ? Date.now() - stats.installTime : 0,
  }
}

/**
 * Full async cache report — includes cache-size estimates.  The client
 * must request this via DSH_CACHE_REPORT and await the response over
 * MessageChannel; it cannot be answered synchronously because Cache API
 * size queries are async.
 */
async function getDetailedReport() {
  const [cacheSize, entryCount] = await Promise.all([
    estimateCacheSize(), countCacheEntries(),
  ])
  return {
    ...getStatsReport(),
    cacheSizeBytes: cacheSize,
    cacheEntryCount: entryCount,
    cacheName: CACHE_NAME,
    cacheVersion: CACHE_VERSION,
    reportTime: Date.now(),
  }
}

/** Reset all stat counters to zero (does not clear caches). */
function resetStats() {
  stats.shellHits = 0
  stats.staticHits = 0
  stats.staticMisses = 0
  stats.staticErrors = 0
  stats.navTotal = 0
  stats.navNetworkOk = 0
  stats.navFromShell = 0
  stats.navFromOffline = 0
  stats.apiRequests = 0
  stats.apiErrors = 0
  stats.lastResetTime = Date.now()
}

// ── Offline fallback page ───────────────────────────────────────────────
//
// Served when the user navigates and both the network and the cached shell
// are unavailable.  Presents a clean status card with auto-reconnect
// polling.  Matches DSH brand: system type stack, neutral palette, light/dark
// support via prefers-color-scheme (no JS class toggle — the offline page
// cannot access the app's theme store).

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
  html{font-size:16px;-webkit-text-size-adjust:100%}
  body{
    font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;min-height:100dvh;
    background:#fafafa;color:#1a1a1a;
    transition:background .3s,color .3s;
    -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  }
  @media(prefers-color-scheme:dark){
    body{background:#171717;color:#e5e5e5}
  }
  .page{
    display:flex;flex-direction:column;align-items:center;
    text-align:center;padding:2rem;max-width:30rem;width:100%;
  }
  .icon{
    width:4rem;height:4rem;margin-bottom:1.25rem;line-height:1;
    display:flex;align-items:center;justify-content:center;
    border-radius:1rem;font-size:2rem;
    background:#f0f0f0;color:#666;
    transition:background .3s,color .3s;
  }
  @media(prefers-color-scheme:dark){
    .icon{background:#2a2a2a;color:#999}
  }
  h1{font-size:1.15rem;font-weight:600;margin-bottom:.375rem;letter-spacing:-.01em}
  .subtitle{
    font-size:.875rem;line-height:1.55;color:#666;margin-bottom:1.5rem;
    max-width:22rem;
  }
  @media(prefers-color-scheme:dark){.subtitle{color:#999}}
  .btn{
    display:inline-flex;align-items:center;gap:.375rem;
    padding:.55rem 1.25rem;font-size:.8125rem;font-weight:500;
    color:#fff;background:#2563eb;
    border:none;border-radius:.5rem;cursor:pointer;
    text-decoration:none;transition:background .15s,transform .1s;
    -webkit-tap-highlight-color:transparent;user-select:none;
  }
  .btn:hover{background:#1d4ed8}
  .btn:active{background:#1e40af;transform:scale(.98)}
  .btn:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
  .btn .spinner{
    display:none;width:.875rem;height:.875rem;
    border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
    border-radius:50%;animation:spin .6s linear infinite;
  }
  .btn.loading .spinner{display:block}
  .btn.loading .label{opacity:.6}
  @keyframes spin{to{transform:rotate(360deg)}}
  .status{
    margin-top:1.5rem;font-size:.75rem;color:#999;
    min-height:1.1rem;transition:color .3s;
  }
  @media(prefers-color-scheme:dark){.status{color:#666}}
  .status.connected{color:#16a34a}
  @media(prefers-color-scheme:dark){.status.connected{color:#4ade80}}
  .meta{
    margin-top:2rem;font-size:.6875rem;color:#bbb;
    display:flex;flex-direction:column;gap:.25rem;align-items:center;
  }
  @media(prefers-color-scheme:dark){.meta{color:#555}}
</style>
</head>
<body>
<div class="page">
  <div class="icon" aria-hidden="true">&#x26A1;</div>
  <h1>No Connection</h1>
  <p class="subtitle">
    You&rsquo;re offline. The app shell and cached assets are still available
    &mdash; your work is safe.
  </p>
  <button class="btn" id="retry-btn" onclick="retryConnect()" aria-live="polite">
    <span class="spinner" aria-hidden="true"></span>
    <span class="label">Try Again</span>
  </button>
  <div class="status" id="status">Checking connection&hellip;</div>
  <div class="meta">
    <span>DeepSeek Harness</span>
    <span id="offline-time"></span>
  </div>
</div>
<script>
  // Record when this offline page was shown.
  var offlineStart = Date.now()
  document.getElementById('offline-time').textContent =
    'Went offline ' + new Date(offlineStart).toLocaleTimeString()

  var attempts = 0
  var maxAttempts = 300 // ~5 minutes at 1 s intervals
  var retrying = false

  function retryConnect() {
    if (retrying) return
    retrying = true
    var btn = document.getElementById('retry-btn')
    btn.classList.add('loading')
    fetch('./', { method: 'HEAD', cache: 'no-store' })
      .then(function(r) {
        if (r.ok) onReconnected()
        else { btn.classList.remove('loading'); retrying = false }
      })
      .catch(function() { btn.classList.remove('loading'); retrying = false })
  }

  function onReconnected() {
    clearInterval(timer)
    document.getElementById('status').textContent = 'Connection restored! Reloading&hellip;'
    document.getElementById('status').classList.add('connected')
    setTimeout(function() { window.location.reload() }, 600)
  }

  var timer = setInterval(function check() {
    attempts++
    fetch('./', { method: 'HEAD', cache: 'no-store' })
      .then(function(r) {
        if (r.ok) onReconnected()
        else {
          document.getElementById('status').textContent =
            'Still offline &middot; attempt ' + attempts
        }
      })
      .catch(function() {
        document.getElementById('status').textContent =
          'Still offline &middot; attempt ' + attempts
      })
    if (attempts >= maxAttempts) {
      clearInterval(timer)
      document.getElementById('status').textContent = 'No connection after 5 minutes &middot; tap to retry'
    }
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
  if (type === 'DSH_CACHE_REPORT') {
    // Full async report including cache-size estimates.
    event.waitUntil(
      getDetailedReport().then(report => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(report)
        } else if (event.source) {
          event.source.postMessage({ type: 'DSH_CACHE_REPORT_REPLY', report })
        }
      }),
    )
  }
  if (type === 'DSH_RESET_STATS') {
    resetStats()
    if (event.source) {
      event.source.postMessage({ type: 'DSH_RESET_STATS_REPLY', resetTime: stats.lastResetTime })
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
  recordHit('nav-total')
  try {
    const response = await fetch(request)
    if (response.ok) {
      recordHit('nav-network')
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
      recordHit('nav-shell')
      return cached
    }
    const shell = await caches.match('/index.html')
    if (shell) {
      recordHit('nav-shell')
      return shell
    }
    recordHit('nav-offline')
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
    recordHit('static-error')
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

/** API / other: network-only; let the application handle failures. */
async function networkOnlyHandler(request) {
  recordHit('api-request')
  try {
    return await fetch(request)
  } catch {
    recordHit('api-error')
    throw // rethrow — the app should handle the NetworkError
  }
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