import styles from './PullToRefresh.module.css'

/** States the pull-to-refresh indicator can be in. */
export type PullToRefreshState = 'idle' | 'ready' | 'refreshing'

/** Props for the PullToRefresh visual indicator. */
export interface PullToRefreshProps {
  /** Current pull state driving the CSS transitions. */
  state: PullToRefreshState
  /** Label shown below the arrow.  The consumer owns localisation. */
  label?: string
  /** Optional class appended to the indicator container. */
  className?: string
}

/**
 * A minimal pull-to-refresh indicator shell.
 *
 * The consumer owns the touch-event logic (threshold detection, refresh
 * callback); this component only renders the visual states — collapsed
 * at `idle`, arrow-reversed at `ready`, and a CSS spinner at `refreshing`.
 *
 * Height switches instantaneously (no transition) to avoid per-frame
 * layout; content visibility animates via `scaleY` on the GPU compositor.
 *
 * Intended to sit above a scroll container with `overscroll-behavior: contain`.
 */
export function PullToRefresh({ state, label = '', className }: PullToRefreshProps) {
  return (
    <div
      className={[styles.indicator, className].filter(Boolean).join(' ')}
      data-pull-state={state}
    >
      <div className={styles.inner}>
        <div className={styles.spinner} />
        <div className={styles.label}>
          <span className={styles.arrow}>↓</span>
          {label && <span>{label}</span>}
        </div>
      </div>
    </div>
  )
}
