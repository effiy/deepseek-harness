/**
 * React hook for detecting the user's OS-level reduced-motion preference.
 *
 * Uses `useSyncExternalStore` so the component re-renders when the OS
 * accessibility setting changes (without polling).
 *
 * @returns true when the user prefers reduced motion.
 *
 * @example
 * ```tsx
 * import { useReducedMotion } from '@deepseek-ai/dsh-ui-primitives'
 *
 * function AnimatedBubble() {
 *   const reduced = useReducedMotion()
 *   const animation = reduced ? {} : { /* spring config *​/ }
 *   // ...
 * }
 * ```
 */
import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(callback: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const mql = matchMedia(REDUCED_MOTION_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Returns `true` when the user's OS "Reduce motion" accessibility setting is enabled. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
