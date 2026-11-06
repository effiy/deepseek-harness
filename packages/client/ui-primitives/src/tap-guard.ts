/**
 * Double-tap deduplication for touch action targets.
 *
 * A guard accepts the first tap of a key and ignores repeats of the same key
 * inside the window, so one physical double-tap fires its action once. Keys
 * keep independent windows: alternating targets (Stop then Send, two panel
 * tabs) never block one another.
 *
 * @module tapGuard
 */

/**
 * Tap interval that reads as one intended action rather than two.
 * Matches the 300 ms double-tap discrimination window browsers use for
 * zoom suppression on `touch-action: manipulation` surfaces.
 */
export const TAP_GUARD_WINDOW_MS = 300

/** One double-tap deduplication window set. */
export interface TapGuard {
  /**
   * Register a tap and report whether its action should run.
   * @param key - identity of the tapped target; taps of different keys are independent.
   * @returns true for the first tap of the key inside the window, false for a repeat.
   */
  accept(key?: string): boolean
}

/**
 * Create an independent double-tap guard.
 * @param windowMs - repeat-ignore window in milliseconds.
 * @param now - millisecond clock; injectable for deterministic tests.
 * @returns a guard whose accept() reports whether an action should run.
 */
export function createTapGuard(windowMs: number, now: () => number = () => performance.now()): TapGuard {
  const lastAccepted = new Map<string, number>()
  return {
    accept(key = ''): boolean {
      const stamp = now()
      const previous = lastAccepted.get(key)
      if (previous !== undefined && stamp - previous < windowMs) return false
      lastAccepted.set(key, stamp)
      return true
    },
  }
}
