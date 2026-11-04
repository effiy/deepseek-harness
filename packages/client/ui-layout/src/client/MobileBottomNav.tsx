/**
 * Bottom navigation bar rendered on narrow viewports.  Registered into the
 * `shell.bottom` slot through a per-registration `inject` that provides the
 * layout store instance as a bare observable (the framework binds it to
 * `useLayoutStore`) and the bound `actions`.
 *
 * The component always renders; CSS `@media (max-width: 899px)` on `.root`
 * hides the bar above the `--ds-bp-tablet` threshold (900 px) so the footer
 * row stays at zero height on wide viewports.
 */
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId, PanelActions } from './service.ts'
import css from './MobileBottomNav.module.css'

// ---------------------------------------------------------------------------
// Inline SVG icons (20×20 viewbox).
// ---------------------------------------------------------------------------

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3C6.134 3 3 5.686 3 9c0 1.537.682 2.944 1.801 4.002l-.801 3.198 3.3-.825A8.13 8.13 0 0 0 10 15c3.866 0 7-2.686 7-6s-3.134-6-7-6Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function WorkspaceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 7a2 2 0 0 1 2-2h3l2-2h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 1.5v2m0 13v2M18.5 10h-2m-13 0h-2m12.01-5.99-1.42 1.42m-9.19 9.19-1.42 1.42m12.02 0-1.42-1.42m-9.19-9.19-1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Nav button descriptors (branded panel ids).
// ---------------------------------------------------------------------------

interface NavButton {
  id: MainPanelId | null
  label: string
  Icon: () => JSX.Element
}

const NAV_BUTTONS: readonly NavButton[] = [
  { id: null,                                        label: 'Chat',       Icon: ChatIcon },
  { id: brandString<MainPanelId>('workspace'),       label: 'Workspace',  Icon: WorkspaceIcon },
  { id: brandString<MainPanelId>('schedule'),        label: 'Schedule',   Icon: ScheduleIcon },
  { id: brandString<MainPanelId>('settings'),        label: 'Settings',   Icon: SettingsIcon },
]

// ---------------------------------------------------------------------------
// Component.  The framework binds the injected `hooks.layoutStore` observable
// to `useLayoutStore` (a SnapshotSelectorHook).  The bound `actions` arrive
// as a plain value through the inject face.
// ---------------------------------------------------------------------------

/** The subset of LayoutState the bottom nav reads. */
interface LayoutSnapshot {
  panelInfo: { activePanelId: MainPanelId | null }
  layoutInfo: { narrowExpanded: boolean }
}

export interface MobileBottomNavProps {
  /** Bound layout store actions (selectPanel, …). */
  actions: PanelActions
  /** Framework-bound selector hook over the injected store observable. */
  useLayoutStore: SnapshotSelectorHook<LayoutSnapshot>
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 6h14M4 11h14M4 16h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MobileBottomNav({ actions, useLayoutStore }: MobileBottomNavProps) {
  const activePanelId = useLayoutStore(s => s.panelInfo.activePanelId)
  const narrowExpanded = useLayoutStore(s => s.layoutInfo.narrowExpanded)

  return (
    <nav className={css.root} role="navigation" aria-label="Main navigation">
      <button
        className={css.hamburger}
        onClick={() => { actions.toggleSidebar() }}
        aria-label="Toggle sidebar"
        aria-expanded={narrowExpanded}
      >
        <HamburgerIcon />
      </button>
      <span className={css.separator} aria-hidden="true" />
      <div className={css.tabGroup}>
        {NAV_BUTTONS.map(btn => (
          <button
            key={btn.label}
            className={`${css.button} ${activePanelId === btn.id ? css.active : ''}`}
            onClick={() => { actions.selectPanel(btn.id) }}
            aria-label={btn.label}
            aria-current={activePanelId === btn.id ? 'page' : undefined}
          >
            <btn.Icon />
          </button>
        ))}
      </div>
    </nav>
  )
}
