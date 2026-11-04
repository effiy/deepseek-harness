/**
 * Crash recovery: persist the active session identity to sessionStorage so a
 * browser crash or forced page reload can restore the user to their last
 * conversation instead of dumping them at the home screen.
 *
 * sessionStorage is tab-scoped and auto-cleaned when the tab closes normally,
 * so a surviving checkpoint is evidence of an unclean exit.
 *
 * Usage:
 *   1. Boot-time: `restoreSessionCheckpoint()` → sessionId or null.
 *   2. Whenever the user navigates to a session:
 *      `CrashRecovery.update(sessionId)`.
 *   Or, for framework-free integration: set `window.__DSH_ACTIVE_SESSION__`
 *   and the periodic save loop picks it up.
 */

const CHECKPOINT_KEY = 'dsh.crash-recovery.v1'
const MAX_CHECKPOINT_AGE_MS = 5 * 60 * 1_000 // 5 minutes
const AUTO_SAVE_INTERVAL_MS = 10_000 // 10 seconds

interface Checkpoint {
  /** The active session id at save time. */
  sessionId: string
  /** Timestamp in ms since epoch. */
  savedAt: number
}

function isRecent(checkpoint: Checkpoint): boolean {
  return Date.now() - checkpoint.savedAt < MAX_CHECKPOINT_AGE_MS
}

/** Read the last saved checkpoint, or null when absent or stale. */
export function restoreSessionCheckpoint(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CHECKPOINT_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isCheckpoint(parsed) || !isRecent(parsed)) {
      sessionStorage.removeItem(CHECKPOINT_KEY)
      return null
    }
    return parsed.sessionId
  } catch {
    sessionStorage.removeItem(CHECKPOINT_KEY)
    return null
  }
}

/** Persist a checkpoint for one session. */
function saveCheckpoint(sessionId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
      sessionId,
      savedAt: Date.now(),
    } satisfies Checkpoint))
  } catch {
    // Storage full or unavailable — non-fatal.
  }
}

/** Remove the checkpoint (called on clean session close). */
export function clearSessionCheckpoint(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(CHECKPOINT_KEY)
  } catch { /* non-fatal */ }
}

function isCheckpoint(value: unknown): value is Checkpoint {
  return typeof value === 'object' && value !== null
    && typeof (value as Checkpoint).sessionId === 'string'
    && (value as Checkpoint).sessionId.length > 0
    && typeof (value as Checkpoint).savedAt === 'number'
    && (value as Checkpoint).savedAt > 0
}

/**
 * Managed crash-recovery lifecycle. Call `start()` to begin periodic saves
 * and the `beforeunload` handler. Call `stop()` to tear down.
 */
export class CrashRecovery {
  private intervalId: ReturnType<typeof setInterval> | undefined
  private beforeUnloadHandler: (() => void) | undefined

  /** Begin periodic checkpoint saves. Safe to call more than once. */
  start(): void {
    if (typeof window === 'undefined') return
    if (this.intervalId !== undefined) return

    this.intervalId = setInterval(() => { this.tick() }, AUTO_SAVE_INTERVAL_MS)
    this.beforeUnloadHandler = () => { this.tick() }
    window.addEventListener('beforeunload', this.beforeUnloadHandler)
  }

  /** Stop periodic saves and tear down listeners. */
  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    if (this.beforeUnloadHandler !== undefined) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler)
      this.beforeUnloadHandler = undefined
    }
  }

  /** Manual checkpoint save for an explicit session change. */
  static update(sessionId: string): void {
    saveCheckpoint(sessionId)
  }

  private tick(): void {
    // Read the active session from the bridge global. Plugin code
    // (e.g. workspace navigation) sets this whenever the active
    // session changes; the periodic save picks it up without
    // requiring a direct Cordis service edge.
    const bridge = (globalThis as { __DSH_ACTIVE_SESSION__?: string }).__DSH_ACTIVE_SESSION__
    if (bridge !== undefined && bridge.length > 0) {
      saveCheckpoint(bridge)
    }
  }
}
