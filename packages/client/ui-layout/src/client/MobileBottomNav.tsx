/**
 * Bottom navigation bar rendered on narrow viewports.  {@link registerBottomNav}
 * seats it as the default composition's `shell.bottom` occupant: the
 * registration declares the `layout.bottom-nav` locale (the framework injects
 * the `t` seat), declares the `bottom-nav.tab` child list the feature panels
 * contribute their tab icons through, and injects the validated layout face
 * plus two observables (the layout store and the tab-ledger projection; the
 * renderer binds them to `useLayoutStore` and `useTabs`).  A later dynamic
 * registrant (the experimental inspector panel) shadows the bar at a lower
 * priority; removing it restores the bar.
 *
 * The tab row is data-driven: a fixed Chat button plus one button per
 * `bottom-nav.tab` head entry whose id is also a registered `main` key —
 * a panel the frame cannot open never offers a tab — in ascending `order`.
 * Each tab's label is its entry's resolved slot label (the feature package
 * owns the copy) and its icon is the entry's component, rendered through
 * `renderSlot` with the active-state owner share.
 *
 * The component always renders; CSS `@media (max-width: 900px)` on `.root`
 * hides the bar above the tablet threshold so the footer row stays at zero
 * height on wide viewports.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { IconQueueOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NAV_NS } from './locale.ts'
import type { ILayout, MainPanelId } from './service.ts'
import type { createLayoutStore } from './stores.ts'
import css from './MobileBottomNav.module.css'

// ---------------------------------------------------------------------------
// Tab-ledger projection.
// ---------------------------------------------------------------------------

/** One tab row projected from the `bottom-nav.tab` ledger. */
export interface BottomNavTabMeta {
  /** Main-panel key the tab selects. */
  id: MainPanelId
  /** Ascending display rank among sibling tabs. */
  order: number
  /** Display label resolved from the entry's slot label. */
  label: string
}

/**
 * Project the tab ledger: every `bottom-nav.tab` head entry whose id is also
 * a registered `main` key, in ascending `order`.  The projection caches on
 * the ledger versions and the locale revision — label thunks follow the
 * active dictionary — so the snapshot reference is stable between changes
 * (safe as a uSES getSnapshot source).
 * @param ctx - client context owning the ledger subscriptions.
 * @returns observable of the projected tab rows.
 */
function createTabsSource(ctx: ClientContext): HostObservable<readonly BottomNavTabMeta[]> {
  let tabVersion = -1
  let mainVersion = -1
  let localeRevision = -1
  let tabs: readonly BottomNavTabMeta[] = []
  return {
    getSnapshot: () => {
      const tabV = ctx.slots.getVersion('bottom-nav.tab')
      const mainV = ctx.slots.getVersion('main')
      const revision = ctx.locale.getSnapshot().revision
      if (tabV === tabVersion && mainV === mainVersion && revision === localeRevision) return tabs
      tabVersion = tabV
      mainVersion = mainV
      localeRevision = revision
      const openable = new Set(ctx.slots.entries('main').map(entry => entry.options.key))
      tabs = ctx.slots.entriesOfSlot('bottom-nav.tab').map(({ options }) => {
        // The list registration requires an id; StoredEntry erases the slot kind.
        const id = options.id as MainPanelId
        return { id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? id }
      }).filter(tab => openable.has(tab.id)).sort((a, b) => a.order - b.order)
      return tabs
    },
    subscribe: (listener) => {
      const offTabs = ctx.slots.subscribe('bottom-nav.tab', listener)
      const offMain = ctx.slots.subscribe('main', listener)
      const offLocale = ctx.locale.subscribe(listener)
      return () => { offTabs(); offMain(); offLocale() }
    },
  }
}

// ---------------------------------------------------------------------------
// Component.  The framework binds the injected `hooks` observables to
// `useLayoutStore` and `useTabs` (SnapshotSelectorHooks).  The validated
// layout actions arrive as plain values through the inject face.
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
  /**
   * Select a main panel through the validated ctx.layout face.
   * @param panelId - registered main key, or null to show the Conversation.
   */
  selectPanel(panelId: MainPanelId | null): void
  /** Toggle the narrow-viewport sidebar (double-tap deduplicated). */
  toggleSidebar(): void
  /** Observables the renderer binds to the component's selector hooks. */
  hooks: {
    layoutStore: HostObservable<LayoutSnapshot>
    tabs: HostObservable<readonly BottomNavTabMeta[]>
  }
}

/** Composed props: the frame's runtime share, the tab-icon child-render share, the declared locale's `t`, and the inject face. */
export type MobileBottomNavProps = PropsRuntime<'shell.bottom'>
  & PropsRenderSlots<'bottom-nav.tab'>
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

/**
 * Render the bar: the sidebar hamburger, the fixed Chat tab, and one tab per
 * projected ledger row.
 * @param props - the composed slot props (see {@link MobileBottomNavProps}).
 * @returns the navigation element (CSS hides it above the tablet threshold).
 */
export function MobileBottomNav({ selectPanel, toggleSidebar, useLayoutStore, useTabs, t, renderSlot }: MobileBottomNavProps) {
  const activePanelId = useLayoutStore(snapshot => snapshot.panelInfo.activePanelId)
  const narrowExpanded = useLayoutStore(snapshot => snapshot.layoutInfo.narrowExpanded)
  const tabs = useTabs(snapshot => snapshot)

  return (
    <nav className={css.root} role="navigation" aria-label={t('nav.mainNavigation')}>
      <button
        className={css.hamburger}
        onClick={() => { toggleSidebar() }}
        aria-label={t('nav.toggleSidebar')}
        aria-expanded={narrowExpanded}
      >
        <HamburgerIcon />
      </button>
      <span className={css.separator} aria-hidden="true" />
      <div className={css.tabGroup}>
        <button
          className={`${css.button} ${activePanelId === null ? css.active : ''}`}
          onClick={() => { selectPanel(null) }}
          aria-current={activePanelId === null ? 'page' : undefined}
        >
          <IconQueueOutlineRegular size={20} />
          <span className={css.label}>{t('nav.chat')}</span>
        </button>
        {tabs.map((tab) => {
          const active = activePanelId === tab.id
          return (
            <button
              key={tab.id}
              className={`${css.button} ${active ? css.active : ''}`}
              onClick={() => { selectPanel(tab.id) }}
              aria-current={active ? 'page' : undefined}
            >
              {renderSlot('bottom-nav.tab', { size: 20, active }, { only: tab.id })}
              <span className={css.label}>{tab.label}</span>
            </button>
          )
        })}
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
 * The registration declares the `layout.bottom-nav` locale and the
 * `bottom-nav.tab` child list, and injects the validated layout face plus the
 * store and tab-ledger observables; the renderer binds the observables to the
 * component's `useLayoutStore` and `useTabs` seats.
 * @param ctx - client context owning the registration.
 * @param instance - the shared layout store instance the frame renders from.
 * @param layout - the validated panel-action face (ctx.layout) the buttons dispatch through.
 * @returns disposer removing the registration and the `bottom-nav.tab` declaration with it.
 */
export function registerBottomNav(ctx: ClientContext, instance: LayoutStoreInstance, layout: ILayout): () => void {
  const tabs = createTabsSource(ctx)
  return ctx.slots.register({
    name: 'shell.bottom',
    locale: NAV_NS,
    children: { 'bottom-nav.tab': { kind: 'list', scope: 'root' } },
    inject: (): BottomNavInjected => ({
      selectPanel: (panelId) => { layout.selectPanel(panelId) },
      toggleSidebar: () => { layout.toggleSidebar() },
      hooks: { layoutStore: instance, tabs },
    }),
  }, MobileBottomNav)
}
