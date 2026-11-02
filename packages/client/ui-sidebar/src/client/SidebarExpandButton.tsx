/**
 * The way into a hidden left sidebar: one button in the conversation header's
 * leading area (left side), shown only while the sidebar is collapsed.
 *
 * Unlike the right sidebar's ExpandButton which sits in the header's corner,
 * this button lives in the header's leading slot — the same side the panel
 * slides in from. Left for the left sidebar, right for the right sidebar:
 * symmetric and discoverable.
 *
 * It shares the sidebar's shortcut and locale seat with SidebarRoot, and reads
 * the layout's global collapsed state rather than a per-session store.
 */
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactNode } from 'react'
import { Button, IconPanelLeftOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the conversation header slot declarations.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './SidebarExpandButton.module.css'

/** The button's props: the conversation header's leading seat, injected layout facts, and copy. */
export type SidebarExpandButtonProps =
  PropsRuntime<'conversation.header.leading'>
  & PropsLocale<'sidebar'>
  & InjectFace<{
    toggleSidebar: () => void
    hooks: {
      sidebarCollapsed: HostObservable<boolean>
      shortcuts: HostObservable<readonly ShortcutCatalogEntry[]>
    }
  }>

/** The expand control while the sidebar is collapsed; nothing while it is shown. */
export function SidebarExpandButton({ toggleSidebar, useSidebarCollapsed, useShortcuts, t }: SidebarExpandButtonProps): ReactNode {
  const shortcut = useShortcuts(entries => entries.find(entry => entry.id === 'sidebar.left.toggle'))
  const collapsed = useSidebarCollapsed(value => value)
  if (!collapsed) return null
  return (
    <Tooltip label={t('toggle.open')} shortcutKeys={shortcut?.keys} side="bottom" delayMs={500}>
      <Button
        size="sm"
        className={css.button}
        aria-label={t('toggle.open')}
        aria-keyshortcuts={shortcut?.aria}
        data-sidebar-left-expand
        onClick={() => { toggleSidebar() }}
      >
        <IconPanelLeftOutlineRegular size={15} />
      </Button>
    </Tooltip>
  )
}
