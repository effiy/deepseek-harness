/** Locale dictionaries for the surfaces the web boot kernel registers itself. */

/** Namespace the network-status banner copy registers under. */
export const NETWORK_STATUS_NS = 'web.network-status'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const networkStatusZh = {
  offline: '网络连接已断开',
} satisfies Record<string, string>

/** The network-status namespace key union. */
export type NetworkStatusKey = keyof typeof networkStatusZh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Offline banner shown over the mounted application. */
    'web.network-status': NetworkStatusKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const networkStatusEn = {
  offline: 'No internet connection',
} satisfies Record<NetworkStatusKey, string>
