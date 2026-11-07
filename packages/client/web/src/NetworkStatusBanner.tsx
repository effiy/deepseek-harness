/**
 * Network status banner — offline indicator at the top of the viewport.
 * Registered in `shell.overlay` so it floats above all column content.
 * Uses inline styles (no CSS module dependency) so it renders even when
 * the app's style pipeline is unavailable.
 */
import type { ReactNode } from 'react'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `shell.overlay` SlotMap declaration this entry registers into.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

/** Business face the boot registration injects. */
export interface NetworkStatusInjected {
  hooks: {
    /** Observable from ConnectionHandle.networkAvailable. */
    readonly networkAvailable: HostObservable<boolean>
  }
}

/** Props of the `shell.overlay` entry: the availability hook and localized copy. */
export type NetworkStatusBannerProps = PropsRuntime<'shell.overlay'>
  & PropsLocale<'web.network-status'>
  & InjectFace<NetworkStatusInjected>

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  background: '#fef3c7',
  color: '#92400e',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.4,
  textAlign: 'center',
  pointerEvents: 'none',
}

const iconStyle: React.CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1,
  flexShrink: 0,
}

const labelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** Injected <style> to add animation and dark-mode support. */
let bannerStylesInjected = false
const BANNER_CSS = /* css */ `
@keyframes _nws_slideIn {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
._nws_banner { animation: _nws_slideIn 0.3s ease-out; }
@media (prefers-color-scheme: dark) {
  ._nws_banner { background: #422006; color: #fde68a; }
}`

/**
 * Render the offline banner while the connection reports unavailable.
 * @param props - the availability selector hook and the locale seat.
 * @returns the banner, or null while the network is available.
 */
export function NetworkStatusBanner({ useNetworkAvailable, t }: NetworkStatusBannerProps): ReactNode {
  const available = useNetworkAvailable(current => current)

  if (available) return null

  if (!bannerStylesInjected && typeof document !== 'undefined') {
    bannerStylesInjected = true
    document.head.insertAdjacentHTML('beforeend', `<style data-dsh-network-banner>${BANNER_CSS}</style>`)
  }

  return (
    <div className="_nws_banner" style={bannerStyle} role="status" aria-live="polite">
      <span style={iconStyle} aria-hidden="true">{'\u{1F4E1}'}</span>
      <span style={labelStyle}>{t('offline')}</span>
    </div>
  )
}
