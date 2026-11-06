import { Fragment, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { MenuSurface } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ContextMenu.module.css'

/** One item in a context menu. */
export interface ContextMenuItem {
  /** Display label. */
  label: string
  /** Icon element (16–20px). */
  icon: ReactNode
  /** Danger-styled item (red text). */
  danger?: boolean
  /** Action to run on tap; the menu closes after. */
  action: () => void
}

/**
 * Fixed-position long-press context menu on the shared MenuSurface material
 * (compact radius, translucent fill + blur), with a scale+fade enter animation
 * from the finger origin; dismisses on outside tap or scroll.
 *
 * @param props - Menu items, position, and dismiss callback.
 */
export function ContextMenu({ items, position, onDismiss }: {
  items: ContextMenuItem[]
  position: { top: number; left: number; originX: number; originY: string }
  onDismiss: () => void
}): ReactNode {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dismiss = (e: Event): void => {
      /* v8 ignore next -- the ref detaches before this passive listener's cleanup; no dispatched event can observe the gap. */
      if (menuRef.current === null) return
      if (menuRef.current.contains(e.target as Node)) return
      onDismiss()
    }
    // pointerdown gives instant feedback vs click's 300ms delay on mobile
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', onDismiss, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', onDismiss, { capture: true })
    }
  }, [onDismiss])

  return (
    <MenuSurface
      ref={menuRef}
      compact
      className={css.menu}
      style={{
        '--menu-origin-x': `${position.originX}%`,
        '--menu-origin-y': position.originY,
        top: `${position.top}px`,
        left: `${position.left}px`,
      } as CSSProperties}
      role="menu"
    >
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <div className={css.divider} role="separator" />}
          <button
            type="button"
            className={`${css.item} ${item.danger === true ? css.danger : ''}`}
            role="menuitem"
            onClick={() => {
              item.action()
              onDismiss()
            }}
          >
            <span className={css.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        </Fragment>
      ))}
    </MenuSurface>
  )
}
