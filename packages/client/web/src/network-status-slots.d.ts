/**
 * SlotMap augmentation for the web shell.  Registers the `shell.overlay` slot
 * that `@deepseek-ai/dsh-client-ui-layout` declares, so the boot-time
 * `NetworkStatusBanner` registration is well-typed without adding a direct
 * tsconfig reference edge to that package.
 */
import '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'shell.overlay': {
      kind: 'list'
      scope: 'root'
      /** We do not declare children for the banner; the shell owns it alone. */
      children?: Record<never, never>
    }
  }
}
