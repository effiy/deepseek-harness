/**
 * Bottom navigation bar rendered on narrow viewports.  {@link registerBottomNav}
 * seats it as the default composition's `shell.bottom` occupant: the
 * registration declares the `layout.bottom-nav` locale (the framework injects
 * the `t` seat) and a per-registration `inject` carrying the bound `actions`
 * and the layout store instance as a bare observable (the renderer binds it to
 * `useLayoutStore`).  A later dynamic registrant (the experimental inspector
 * panel) shadows the bar at a lower priority; removing it restores the bar.
 *
 * The component always renders; CSS `@media (max-width: 899px)` on `.root`
 * hides the bar above the `--ds-bp-tablet` threshold (900 px) so the footer
 * row stays at zero height on wide viewports.
 */
import type { JSX } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NAV_NS, type BottomNavKey } from './locale.ts'
import type { MainPanelId, PanelActions } from './service.ts'
import type { createLayoutStore } from './stores.ts'
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
  labelKey: BottomNavKey
  Icon: () => JSX.Element
}

const NAV_BUTTONS: readonly NavButton[] = [
  { id: null,                                        labelKey: 'nav.chat',      Icon: ChatIcon },
  { id: brandString<MainPanelId>('workspace'),       labelKey: 'nav.workspace', Icon: WorkspaceIcon },
  { id: brandString<MainPanelId>('schedule'),        labelKey: 'nav.schedule',  Icon: ScheduleIcon },
  { id: brandString<MainPanelId>('settings'),        labelKey: 'nav.settings',  Icon: SettingsIcon },
]

// ---------------------------------------------------------------------------
// Component.  The framework binds the injected `hooks.layoutStore` observable
// to `useLayoutStore` (a SnapshotSelectorHook).  The bound `actions` arrive
// as a plain value through the inject face.
// ---------------------------------------------------------------------------

/** The subset of LayoutState the bottom nav reads. */
export interface LayoutSnapshot {
  /** Main-panel selection; `null` is the conversation. */
  panelInfo: { activePanelId: MainPanelId | null }
  /** Narrow-viewport sidebar override state. */
  layoutInfo: { narrowExpanded: boolean }
}

/** The inject face {@link registerBottomNav} supplies at the registration. */
export interface BottomNavInjected {
  /** Bound layout store actions (selectPanel, toggleSidebar, …). */
  actions: PanelActions
  /** The layout store instance; the renderer binds it to `useLayoutStore`. */
  hooks: { layoutStore: HostObservable<LayoutSnapshot> }
}

/** Composed props: the frame's runtime share, the declared locale's `t`, and the inject face. */
export type MobileBottomNavProps = PropsRuntime<'shell.bottom'>
  & PropsLocale<'layout.bottom-nav'>
  & InjectFace<BottomNavInjected>

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

export function MobileBottomNav({ actions, useLayoutStore, t }: MobileBottomNavProps) {
  const activePanelId = useLayoutStore(s => s.panelInfo.activePanelId)
  const narrowExpanded = useLayoutStore(s => s.layoutInfo.narrowExpanded)

  return (
    <nav className={css.root} role="navigation" aria-label={t('nav.mainNavigation')}>
      <button
        className={css.hamburger}
        onClick={() => { actions.toggleSidebar() }}
        aria-label={t('nav.toggleSidebar')}
        aria-expanded={narrowExpanded}
      >
        <HamburgerIcon />
      </button>
      <span className={css.separator} aria-hidden="true" />
      <div className={css.tabGroup}>
        {NAV_BUTTONS.map(btn => (
          <button
            key={btn.labelKey}
            className={`${css.button} ${activePanelId === btn.id ? css.active : ''}`}
            onClick={() => { actions.selectPanel(btn.id) }}
            aria-label={t(btn.labelKey)}
            aria-current={activePanelId === btn.id ? 'page' : undefined}
          >
            <btn.Icon />
          </button>
        ))}
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Registration.
// ---------------------------------------------------------------------------

/** The shared layout store instance (the store handle's created product). */
export type LayoutStoreInstance = ReturnType<ReturnType<typeof createLayoutStore>['create']>

/**
 * Seat the bottom nav as the default composition's `shell.bottom` occupant.
 * The registration declares the `layout.bottom-nav` locale and injects the
 * bound store actions plus the store instance as a bare observable; the
 * renderer binds the observable to the component's `useLayoutStore` seat.
 * @param ctx - client context owning the registration.
 * @param instance - the shared layout store instance the frame renders from.
 * @returns disposer removing the registration.
 */
export function registerBottomNav(ctx: ClientContext, instance: LayoutStoreInstance): () => void {
  return ctx.slots.register({
    name: 'shell.bottom',
    locale: NAV_NS,
    inject: (): BottomNavInjected => ({
      actions: instance.actions,
      hooks: { layoutStore: instance },
    }),
  }, MobileBottomNav)
}
