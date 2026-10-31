/** Plugin entry: locale dictionaries, edit store, and slot registration for user-message actions. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { TextBlock } from '@deepseek-ai/dsh-llm/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createMessageEditStore } from './store.ts'
import { NS, zh, en } from './locale.ts'
import { UserMessageActions } from './UserMessageActions.tsx'

export const name = 'ui-message-actions'

/** Cordis services required before this plugin activates. */
export const inject = ['locale', 'slots', 'remote', 'remote.session'] as const

/**
 * Register locale dictionaries, create the shared edit/delete store, and
 * fill the per-message actions slot with the edit/delete entry. The
 * framework injects the typed `t` locale seat through `locale: NS`; all
 * UI copy reaches the component through localized props and `t()`.
 *
 * Edit/delete callbacks call the session controller's RPC methods:
 *   remote.session.messageUpdate { sessionId, messageSeq, content }
 *   remote.session.messageDelete { sessionId, messageSeq }
 *
 * @param ctx - Plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-message-actions: dictionaries')
  const store = createMessageEditStore()

  ctx.slots.inject('conversation.chat.user-actions', () =>
    ctx.slots.register({
      name: 'conversation.chat.user-actions',
      id: 'message-actions',
      store,
      locale: NS,
      inject: (sessionId: SessionId) => ({
        editMessage: async (seq: number, text: string) => {
          const content: readonly TextBlock[] = [{ type: 'text', text }]
          await ctx.remote.session['message-update']({ sessionId, messageSeq: seq, content })
        },
        deleteMessage: async (seq: number) => {
          await ctx.remote.session['message-delete']({ sessionId, messageSeq: seq })
        },
      }),
    }, UserMessageActions),
  )
}