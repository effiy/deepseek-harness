/**
 * Offline message queue backed by IndexedDB.
 *
 * Messages that fail to send because the browser is offline are persisted here.
 * When the network returns, the registered drain handler is called to replay
 * each queued operation in FIFO order.
 *
 * Schema:
 *   Database: dsh-offline-messages
 *   Object store: outbox { keyPath: id, autoIncrement: true }
 *   Indexes: sessionId, createdAt, status
 */
export type QueueStatus = 'pending' | 'sending' | 'failed'
/** One queued operation — only the fields needed to replay a send. */
export interface QueuedMessage {
  /** Auto-generated IndexedDB key. */
  id?: number
  /** Target session identity (so the drainer knows which session to send to). */
  sessionId: string
  /** Prompt text. */
  text: string
  /** 'queue' (default) or 'steer'. */
  mode: 'queue' | 'steer'
  /** ISO timestamp of enqueue. */
  createdAt: string
  /** Current queue status. */
  status: QueueStatus
  /** Last error message, for display in the UI. */
  lastError?: string
}
/** Push a message onto the offline queue. */
export declare function enqueueMessage(message: Omit<QueuedMessage, 'id' | 'createdAt' | 'status'>): Promise<QueuedMessage>
/** Get all pending messages, ordered by creation time (FIFO). */
export declare function getPendingMessages(): Promise<QueuedMessage[]>
/** Update a queued message's status in place. */
export declare function updateMessageStatus(id: number, status: QueueStatus, lastError?: string): Promise<void>
/** Remove a successfully-sent message from the queue. */
export declare function removeMessage(id: number): Promise<void>
/** Count pending messages. */
export declare function countPending(): Promise<number>
/** Remove all messages for a given session (e.g., when session is archived). */
export declare function removeSessionMessages(sessionId: string): Promise<void>
/**
 * Drain handler type: given a queued message, attempt to send it.
 * Returns nothing on success; throws on failure (the queue marks it as failed).
 */
export type DrainHandler = (message: QueuedMessage) => Promise<void>
/**
 * Start draining the offline queue, calling `handler` for each pending message
 * in FIFO order. Each message is marked 'sending' before the handler runs.
 * On success it is removed; on failure it is marked 'failed' and the drain
 * continues to the next message.
 *
 * @param handler - function that sends one queued message.
 * @returns count of messages successfully drained.
 */
export declare function drainQueue(handler: DrainHandler): Promise<number>
/**
 * Create the Cordis offline-queue service. The caller wires it into the
 * context via `ctx.provide('offlineQueue', service)` and triggers
 * `service.drain()` when the browser reports online.
 */
export declare function createOfflineQueueService(): OfflineQueueService
//# sourceMappingURL=offline-queue.d.ts.map
