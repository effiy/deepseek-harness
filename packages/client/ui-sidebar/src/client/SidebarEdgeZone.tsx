/**
 * Invisible 16px touch edge zone along the left screen edge that expands the
 * sidebar on tap. Only active on touch-capable narrow viewports (≤640px) while
 * the sidebar is collapsed — WeChat-style drawer gesture affordance.
 *
 * Desktop (pointer: fine) never activates it; the zone stays `display: none`
 * through the CSS media query.
 *
 * Registered to `shell.overlay` so it renders above the frame columns; the
 * zone's `position: fixed` anchors it to the viewport independently of the
 * overlay layer's `position: absolute`.
 */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactNode } from 'react'
import css from './SidebarEdgeZone.module.css'

/** The edge zone's props: the overlay seat, injected layout facts, and copy. */
export type SidebarEdgeZoneProps =
  PropsRuntime<'shell.overlay'>
  & PropsLocale<'sidebar'>
  & InjectFace<{
    toggleSidebar: () => void
    hooks: {
      sidebarCollapsed: HostObservable<boolean>
    }
  }>

/** Renders a transparent left-edge touch zone only when the sidebar is collapsed. */
export function SidebarEdgeZone({ useSidebarCollapsed, toggleSidebar, t }: SidebarEdgeZoneProps): ReactNode {
  const collapsed = useSidebarCollapsed(value => value)
  if (!collapsed) return null
  return (
    <button
      type="button"
      className={css.zone}
      aria-label={t('toggle.open')}
      onClick={() => { toggleSidebar() }}
    />
  )
}
