import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import css from './MessageFold.module.css'

/** Labels the owner resolves from its own locale namespace (cordis-free). */
export interface MessageFoldLabels {
  /** Button label when the content is collapsed. */
  expand: string
  /** Button label when the content is fully visible. */
  collapse: string
}

/**
 * Clips long message content to a configurable height and provides a
 * "Show more" / "Show less" toggle. The fold is purely presentational —
 * it wraps any React children and handles its own collapsed/expanded state.
 *
 * Follows the mobile visual spec: toggle button uses caption size (12/16),
 * spacing uses the canonical 8px grid, and the gradient fade reuses the
 * page background (`--dsw-alias-bg-base`) for seamless blending.
 *
 * @param props.maxHeight  - clipped height in px when collapsed (default 300).
 * @param props.labels     - localized expand and collapse button text.
 * @param props.initiallyCollapsed - start collapsed (default true).
 * @param props.children   - the message body to optionally fold.
 * @returns the folded content wrapper.
 */
export function MessageFold({
  maxHeight = 300,
  labels,
  initiallyCollapsed = true,
  children,
}: {
  maxHeight?: number
  labels: MessageFoldLabels
  initiallyCollapsed?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed)

  const toggle = useCallback(() => {
    setCollapsed(v => !v)
  }, [])

  return (
    <div className={css.wrapper} data-message-fold-collapsed={collapsed ? '' : undefined}>
      <div className={css.content} style={{ maxHeight: collapsed ? `${maxHeight}px` : undefined }}>
        {children}
      </div>
      {collapsed && <div className={css.fade} />}
      <button type="button" className={css.toggle} onClick={toggle}>
        {collapsed ? labels.expand : labels.collapse}
      </button>
    </div>
  )
}
