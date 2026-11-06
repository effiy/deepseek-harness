import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TouchEvent as ReactTouchEvent } from 'react'
import { IconCloseOutlineRegular } from './icons/index.tsx'
import css from './ImageLightbox.module.css'

/** Lightbox strings the owner resolves from its own locale namespace. */
export interface ImageLightboxLabels {
  /** Accessible name of the preview dialog. */
  dialog: string
  /** Accessible label of the close control. */
  close: string
}

/** Minimum distance between two fingers in px before a pinch gesture is recognized. */
const PINCH_THRESHOLD = 10

/** Scale factor applied on double-tap. */
const DOUBLE_TAP_SCALE = 2.5

/** Maximum zoom level. */
const MAX_SCALE = 5

/** Time window in ms for detecting a double-tap. */
const DOUBLE_TAP_WINDOW = 300

/** Maximum spatial drift between two taps to be recognized as double-tap. */
const DOUBLE_TAP_SPATIAL = 30

/** Scale at or below which the image snaps back to the centered, un-zoomed state. */
const SNAP_THRESHOLD = 1.01

/** The viewport-relative zoom transform: translate then scale from the origin. */
interface ZoomTransform {
  scale: number
  x: number
  y: number
}

/** Ephemeral state tracked across touch-move events for one gesture sequence.
 *  Discriminated by `kind` so the touchmove handler gains full type narrowing. */
type GestureState =
  | {
      kind: 'pinch'
      initialDistance: number
      initialScale: number
      initialX: number
      initialY: number
      pinchCenterX: number
      pinchCenterY: number
    }
  | {
      kind: 'pan'
      lastPanX: number
      lastPanY: number
    }

/**
 * Euclidean distance between two touch-point objects.
 * @param touches - array of at least two positions.
 * @returns the distance in px.
 */
function fingerDistance(touches: readonly { clientX: number; clientY: number }[]): number {
  if (touches.length < 2) return 0
  const dx = touches[0]!.clientX - touches[1]!.clientX
  const dy = touches[0]!.clientY - touches[1]!.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Midpoint of two touch-point objects.
 * @param touches - array of at least two positions.
 * @returns the center as client coordinates.
 */
function fingerCenter(touches: readonly { clientX: number; clientY: number }[]): { x: number; y: number } {
  return {
    x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
    y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
  }
}

function clamp(min: number, val: number, max: number): number {
  return val < min ? min : val > max ? max : val
}

/**
 * Document-level original-image preview opened by clicking a thumbnail.
 * Closes on Escape, backdrop tap, or the close control, and restores focus
 * to the opener on unmount. Rendered through a body portal: an opener inside
 * a transformed or filtered ancestor would otherwise trap the fixed backdrop
 * in that ancestor's box instead of covering the viewport.
 *
 * Touch gestures:
 * - Two-finger pinch scales the preview 1×–5× around the pinch center.
 * - Single-finger drag pans once zoomed in.
 * - Double-tap toggles between fit and 2.5× centered on the tap point.
 *
 * @param props.src - the original image URL.
 * @param props.alt - the image's alt text.
 * @param props.labels - dialog and close-control strings.
 * @param props.onClose - dismiss callback owned by the opener.
 * @returns the modal preview dialog.
 */
export function ImageLightbox({ src, alt, labels, onClose }: {
  src: string
  alt: string
  labels: ImageLightboxLabels
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [transform, setTransform] = useState<ZoomTransform>({ scale: 1, x: 0, y: 0 })

  // Gesture tracking is ref-based so touchmove handlers never depend on stale
  // closures while scale/offset updates cause re-renders.
  const gesture = useRef<GestureState | null>(null)

  // Double-tap detection: last tap's time and viewport position.
  const lastTap = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 })

  // ── Body scroll lock ────────────────────────────────────────────────────

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Keyboard / focus restore ────────────────────────────────────────────

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      restoreRef.current?.focus()
    }
  }, [onClose])

  // ── Touch gesture handlers ──────────────────────────────────────────────

  const onStageTouchStart = useCallback((e: ReactTouchEvent) => {
    // Let the close button handle its own events.
    if ((e.target as HTMLElement).closest('button')) return

    const touches = Array.from(e.touches)

    if (touches.length === 2) {
      e.preventDefault()
      const dist = fingerDistance(touches)
      if (dist < PINCH_THRESHOLD) return
      const center = fingerCenter(touches)
      gesture.current = {
        kind: 'pinch',
        initialDistance: dist,
        initialScale: transform.scale,
        initialX: transform.x,
        initialY: transform.y,
        pinchCenterX: center.x,
        pinchCenterY: center.y,
      }
      return
    }

    if (touches.length === 1) {
      const tx = touches[0]!.clientX
      const ty = touches[0]!.clientY
      // Double-tap detection must run BEFORE the pan track is set up, so a
      // quick pair of taps (even on a zoomed image) triggers the toggle
      // rather than starting a pan gesture.
      const now = Date.now()
      const prev = lastTap.current
      if (
        now - prev.time < DOUBLE_TAP_WINDOW &&
        Math.abs(tx - prev.x) < DOUBLE_TAP_SPATIAL &&
        Math.abs(ty - prev.y) < DOUBLE_TAP_SPATIAL
      ) {
        lastTap.current = { time: 0, x: 0, y: 0 }
        gesture.current = null
        if (transform.scale > SNAP_THRESHOLD) {
          setTransform({ scale: 1, x: 0, y: 0 })
        } else {
          const vw = window.innerWidth
          const vh = window.innerHeight
          setTransform({
            scale: DOUBLE_TAP_SCALE,
            x: vw / 2 - tx * DOUBLE_TAP_SCALE,
            y: vh / 2 - ty * DOUBLE_TAP_SCALE,
          })
        }
        return
      }
      lastTap.current = { time: now, x: tx, y: ty }
      // When already zoomed, prepare for a potential pan; panning only
      // begins once a touchmove exceeds the initial finger position.
      if (transform.scale > SNAP_THRESHOLD) {
        gesture.current = {
          kind: 'pan',
          lastPanX: tx,
          lastPanY: ty,
        }
      }
    }
  }, [transform.scale, transform.x, transform.y])

  const onStageTouchMove = useCallback((e: ReactTouchEvent) => {
    const g = gesture.current
    if (g === null) return

    const touches = Array.from(e.touches)

    if (g.kind === 'pinch') {
      e.preventDefault()
      if (touches.length < 2) return
      const dist = fingerDistance(touches)
      const ratio = g.initialDistance > 0 ? dist / g.initialDistance : 1
      const newScale = clamp(1, g.initialScale * ratio, MAX_SCALE)
      const scaleRatio = newScale / g.initialScale
      const center = fingerCenter(touches)
      setTransform({
        scale: newScale,
        x: center.x - (center.x - g.initialX) * scaleRatio,
        y: center.y - (center.y - g.initialY) * scaleRatio,
      })
      return
    }

    if (g.kind === 'pan') {
      if (touches.length !== 1) return
      const dx = touches[0]!.clientX - g.lastPanX
      const dy = touches[0]!.clientY - g.lastPanY
      g.lastPanX = touches[0]!.clientX
      g.lastPanY = touches[0]!.clientY
      setTransform(prev => ({
        scale: prev.scale,
        x: prev.x + dx,
        y: prev.y + dy,
      }))
    }
  }, [])

  const onStageTouchEnd = useCallback(() => {
    gesture.current = null
    // Snap back to fit if the final scale is barely above 1.
    setTransform(prev => (prev.scale <= SNAP_THRESHOLD ? { scale: 1, x: 0, y: 0 } : prev))
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────

  // Disable CSS transition while the user is actively gesturing (pinch / pan);
  // the inline transform updates must be instant. The CSS transition takes
  // over for double-tap and snap-back, producing a smooth ease-out.
  const active = gesture.current !== null || transform.scale > SNAP_THRESHOLD
  const imageStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
    ...(gesture.current !== null ? { transition: 'none' as const } : {}),
    maxWidth: active ? 'none' : undefined,
    maxHeight: active ? 'none' : undefined,
  }

  return createPortal(
    <div
      className={css.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
    >
      <div
        ref={stageRef}
        className={css.stage}
        data-zoomed={transform.scale > SNAP_THRESHOLD ? '' : undefined}
        onTouchStart={onStageTouchStart}
        onTouchMove={onStageTouchMove}
        onTouchEnd={onStageTouchEnd}
      >
        <div className={css.mask} aria-hidden="true" onMouseDown={onClose} />
        <img className={css.image} src={src} alt={alt} style={imageStyle} />
        <button ref={closeRef} type="button" className={css.close} aria-label={labels.close} onClick={onClose}>
          <IconCloseOutlineRegular size={16} />
        </button>
      </div>
    </div>,
    document.body,
  )
}