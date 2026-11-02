import { Fragment, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
 * Fixed-position context menu with WeChat-style appearance:
 * white rounded card, soft shadow, scale+fade enter animation,
 * dismiss on outside tap or scroll.
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
    <div
      ref={menuRef}
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
    </div>
  )
}
