/** Browser entry for the Web client. */
import '@deepseek-ai/dsh-client-ui-theme/brand-font.css'
import { AppWebEntry, applyIndexInjections } from '@deepseek-ai/dsh-client-web'

// ── Service Worker ──────────────────────────────────────────────────────
// Register the SW in production so the app shell and static assets are
// cached for offline use.  The registration is eager (before run()) but
// fire-and-forget — it must not block the app boot.
//
// Lifecycle:
//   1. register('/sw.js') — kickoff, non-blocking
//   2. updatefound  → new SW detected, installing…
//   3. statechange  → installed → waiting → skipWaiting → activating → activated
//   4. controllerchange → new SW is now in control; prompt user to refresh
//
// Cache stats are available through getSWCacheStats(); the SW exposes
// per-layer hit/miss counters via postMessage.

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // ── Update detection ──────────────────────────────────────────
      // When a new SW version is found (updatefound fires), track its
      // installation so we can notify the user once it's ready.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available — dispatch a custom event so the
            // UI layer can show an update banner without importing SW code.
            window.dispatchEvent(new CustomEvent('dsh-sw-update'))
            console.info('[DSH SW] new version ready — refresh to activate')
          }
        })
      })
    }).catch((err: unknown) => {
      console.warn('[DSH SW] registration failed:', err instanceof Error ? err.message : String(err))
    })

    // ── Controller change ───────────────────────────────────────────
    // When skipWaiting() completes and the new SW takes over, prompt
    // the user to reload if they haven't already been asked.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      // The UI layer can listen for this event to show a refresh prompt.
      window.dispatchEvent(new CustomEvent('dsh-sw-activated'))
    })
  })
}

/**
 * Query cache-hit statistics from the active Service Worker.
 *
 * Returns a promise that resolves with the SW's stats report or null
 * when no SW is in control.  The report includes per-layer hit/miss
 * counters, overall hit rate, and uptime.
 */
export async function getSWCacheStats(): Promise<Record<string, number | string> | null> {
  // `navigator.serviceWorker` is undefined outside secure contexts (plain-HTTP
  // LAN access); the DOM types do not model that absence.
  if (!('serviceWorker' in navigator)) return null
  const controller = navigator.serviceWorker.controller
  if (controller === null) return null
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    // Timeout after 2 s — the SW might be busy.
    const timer = setTimeout(() => {
      resolve(null)
    }, 2000)
    channel.port1.onmessage = (event: MessageEvent<Record<string, string | number> | null>) => {
      clearTimeout(timer)
      resolve(event.data)
    }
    channel.port1.onmessageerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    controller.postMessage({ type: 'DSH_CACHE_STATS' }, [channel.port2])
  })
}

interface DesktopBootGlobal {
  dshDesktopBoot?: {
    failed(message: string): Promise<void>
    ready(): Promise<{ injections: Parameters<typeof applyIndexInjections>[0]; streamBaseUrl: string }>
  }
}
const desktop = (globalThis as DesktopBootGlobal).dshDesktopBoot
const reportFailure = (reason: unknown): void => {
  if (desktop === undefined) throw reason
  void desktop.failed(reason instanceof Error ? reason.message : String(reason)).catch(console.error)
}

try {
  const el = document.getElementById('root')
  if (el === null) throw new Error('web app: missing #root')
  const entry = new AppWebEntry(el)
  if (desktop !== undefined) {
    const gate = (globalThis as { __DSH_BOOT_READY__?: PromiseWithResolvers<void> }).__DSH_BOOT_READY__
    if (gate === undefined) throw new Error('desktop web: boot readiness is missing')
    void desktop.ready().then(async ({ injections, streamBaseUrl }) => {
      const transport = globalThis as { __DSH_TRANSPORT__?: { ownsHost: boolean; streamBaseUrl: string } }
      transport.__DSH_TRANSPORT__ = { ownsHost: true, streamBaseUrl }
      await applyIndexInjections(injections, src => new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = () => { resolve() }
        script.onerror = () => { reject(new Error(`desktop web: failed to load ${src}`)) }
        document.head.append(script)
      }))
      gate.resolve()
    }).catch((error: unknown) => { gate.reject(error) })
  }
  void entry.run(desktop === undefined ? undefined : reportFailure)
} catch (reason) {
  reportFailure(reason)
}
