/** Locale dictionaries for the message-actions plugin. */

export const NS = 'message-actions'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'message.edit': '编辑',
  'message.delete': '删除',
  'message.edit.save': '保存',
  'message.edit.cancel': '取消',
  'message.delete.confirmBody': '确定要删除这条消息吗？此操作不可撤销。',
  'message.delete.cancel': '取消',
  'message.delete.ok': '删除',
} satisfies Record<string, string>

/** The message-actions namespace key union. */
export type MessageActionsKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The message-actions surface's copy. */
    'message-actions': MessageActionsKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'message.edit': 'Edit',
  'message.delete': 'Delete',
  'message.edit.save': 'Save',
  'message.edit.cancel': 'Cancel',
  'message.delete.confirmBody': 'Are you sure you want to delete this message? This action cannot be undone.',
  'message.delete.cancel': 'Cancel',
  'message.delete.ok': 'Delete',
} satisfies Record<MessageActionsKey, string>