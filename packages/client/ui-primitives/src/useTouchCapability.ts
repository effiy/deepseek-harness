/**
 * Touch capability detection for responsive mobile interactions.
 *
 * Provides a stable snapshot of the device's pointer characteristics:
 * - `hasCoarsePointer`: matches `@media (pointer: coarse)` — touch devices
 * - `hasFinePointer`: matches `@media (pointer: fine)` — mouse/trackpad
 * - `hasTouchScreen`: `'ontouchstart' in window` — physical touch surface
 * - `primaryInput`: the currently active primary input modality
 *
 * The hook subscribes to `matchMedia` changes so the values stay accurate
 * when a device's pointer characteristics change (e.g., tablet with
 * detachable keyboard, or devtools device emulation toggles).
 *
 * Components use this instead of repeating `matchMedia('(pointer: coarse)')`
 * calls, which would each register their own listener.
 *
 * @module useTouchCapability
 */

import { useEffect, useState } from 'react'

/** Pointer capability snapshot for one render frame. */
export interface TouchCapability {
  /** True when the primary pointer is coarse (touch). */
  hasCoarsePointer: boolean
  /** True when a fine pointer (mouse / trackpad) is available. */
  hasFinePointer: boolean
  /** True when the device surface supports touch events. */
  hasTouchScreen: boolean
  /** The primary input type derived from the pointer media query. */
  primaryInput: 'touch' | 'mouse' | 'pen'
}

function readCapability(): TouchCapability {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
  return {
    hasCoarsePointer: coarse,
    hasFinePointer: fine,
    hasTouchScreen: typeof window !== 'undefined' && 'ontouchstart' in window,
    primaryInput: coarse ? 'touch' : 'mouse',
  }
}

/**
 * Subscribe to the device's pointer capability.
 * @returns the current pointer capability snapshot.
 */
export function useTouchCapability(): TouchCapability {
  const [cap, setCap] = useState<TouchCapability>(readCapability)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return

    const mq = matchMedia('(pointer: coarse)')
    const onChange = (): void => {
      setCap(prev => ({
        ...prev,
        hasCoarsePointer: mq.matches,
        primaryInput: mq.matches ? 'touch' : 'mouse',
      }))
    }

    // Modern browsers
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }

    // Legacy (Safari < 14)
    const legacy = mq as unknown as { addListener?: (cb: () => void) => void; removeListener?: (cb: () => void) => void }
    if (typeof legacy.addListener === 'function') {
      legacy.addListener(onChange)
      return () => legacy.removeListener?.(onChange)
    }
  }, [])

  return cap
}
