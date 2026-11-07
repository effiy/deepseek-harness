/** Locale dictionaries for the layout plugin's mobile bottom navigation. */

/** Namespace the bottom-nav labels register under. */
export const NAV_NS = 'layout.bottom-nav'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const navZh = {
  'nav.chat': '对话',
  'nav.mainNavigation': '主导航',
  'nav.toggleSidebar': '展开／收起左侧栏',
} satisfies Record<string, string>

/** The bottom-nav namespace key union. */
export type BottomNavKey = keyof typeof navZh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mobile bottom-navigation labels. */
    'layout.bottom-nav': BottomNavKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const navEn = {
  'nav.chat': 'Chat',
  'nav.mainNavigation': 'Main navigation',
  'nav.toggleSidebar': 'Toggle left sidebar',
} satisfies Record<BottomNavKey, string>
