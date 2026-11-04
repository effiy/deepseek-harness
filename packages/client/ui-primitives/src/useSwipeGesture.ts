/**
 * Lightweight horizontal swipe gesture detection for touch surfaces.
 *
 * Returns React touch-event handlers that track horizontal swipes and fire
 * callbacks when a swipe crosses the configured threshold.  The caller
 * spreads the handlers onto the target element and reads `swiped.current`
 * in its own click handler to avoid double-trigger from tap→swipe.
 *
 * Intended for mobile sidebar gestures: swipe-right to open, swipe-left to
 * close.  Also usable for carousel / tab-swipe patterns.
 *
 * @module useSwipeGesture
 */

import { useCallback, useRef } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'

/** Callbacks for left and right swipe detection. */
export interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

/** Internal touch-tracking state — direction-only (no distance accumulation). */
interface TouchState {
  startX: number
  startY: number
  /** null = no swipe yet; 'left' | 'right' = recognized direction. */
  dir: 'left' | 'right' | null
}

/** Return value: touch event props to spread + a ref for click suppression. */
export interface SwipeGestureProps {
  onTouchStart: (e: ReactTouchEvent) => void
  onTouchMove: (e: ReactTouchEvent) => void
  onTouchEnd: (e: ReactTouchEvent) => void
  /**
   * True when the current touch sequence was recognized as a swipe.
   * Read in onClick to skip the action when the user swiped.
   * Automatically reset on the next touchstart.
   */
  swiped: React.RefObject<boolean>
}

/**
 * Detect horizontal swipe gestures on a touch-enabled element.
 *
 * Only horizontal swipes are recognized; the vertical-to-horizontal ratio
 * must exceed 2:1 to avoid false positives from vertical scroll.
 *
 * @param handlers - callbacks invoked on swipe recognition.
 * @param threshold - minimum horizontal distance in px (default 30).
 * @returns touch event handlers and a `swiped` ref for click suppression.
 *
 * @example
 * ```tsx
 * const swipe = useSwipeGesture({ onSwipeRight: openSidebar })
 * return (
 *   <button
 *     onTouchStart={swipe.onTouchStart}
 *     onTouchMove={swipe.onTouchMove}
 *     onTouchEnd={swipe.onTouchEnd}
 *     onClick={() => { if (!swipe.swiped.current) openSidebar() }}
 *   />
 * )
 * ```
 */
export function useSwipeGesture(handlers: SwipeHandlers, threshold = 30): SwipeGestureProps {
  const state = useRef<TouchState>({ startX: 0, startY: 0, dir: null })
  const swipedRef = useRef(false)
  const { onSwipeLeft, onSwipeRight } = handlers

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    state.current = { startX: touch.clientX, startY: touch.clientY, dir: null }
    swipedRef.current = false
  }, [])

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    const s = state.current
    if (s.dir !== null) return // already recognized
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - s.startX
    const dy = touch.clientY - s.startY
    // Only horizontal swipes (>2:1 ratio, >threshold px).
    if (Math.abs(dx) <= threshold) return
    if (Math.abs(dx) <= Math.abs(dy) * 2) return
    s.dir = dx > 0 ? 'right' : 'left'
    swipedRef.current = true
  }, [threshold])

  const onTouchEnd = useCallback(() => {
    const s = state.current
    if (s.dir === 'right') onSwipeRight?.()
    else if (s.dir === 'left') onSwipeLeft?.()
    // Keep swipedRef true so the subsequent click (~300ms later) can read it.
    // Reset happens on the next touchstart.
  }, [onSwipeLeft, onSwipeRight])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swiped: swipedRef,
  }
}
