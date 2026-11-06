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

const DB_NAME = 'dsh-offline-messages'
const DB_VERSION = 1
const STORE_NAME = 'outbox'

/** Open (or create) the IndexedDB database and return the object store for write operations. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('Failed to open offline queue database')) }
    request.onblocked = () => { reject(new Error('Offline queue database blocked — close other tabs')) }
  })
}

function storeTransaction(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode)
  return tx.objectStore(STORE_NAME)
}

/**
 * Push a message onto the offline queue.
 * @param message - session, text, and mode of the message to queue; `id`, `createdAt`, and `status` are assigned here.
 * @returns the stored record with its generated id and enqueue metadata.
 */
export async function enqueueMessage(message: Omit<QueuedMessage, 'id' | 'createdAt' | 'status'>): Promise<QueuedMessage> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readwrite')
    const record: QueuedMessage = {
      ...message,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    const request = store.add(record)
    request.onsuccess = () => {
      resolve({ ...record, id: request.result as number })
      db.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Failed to enqueue offline message'))
      db.close()
    }
  })
}

/**
 * Get all pending messages, ordered by creation time (FIFO).
 * @returns every queued message whose status is `pending`, oldest first.
 */
export async function getPendingMessages(): Promise<QueuedMessage[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readonly')
    const index = store.index('status')
    const range = IDBKeyRange.only('pending')
    const request = index.getAll(range)
    request.onsuccess = () => {
      const results = (request.result as QueuedMessage[]).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      resolve(results)
      db.close()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read offline queue'))
      db.close()
    }
  })
}

/**
 * Update a queued message's status in place.
 * @param id - IndexedDB key of the queued message.
 * @param status - new queue status.
 * @param lastError - error text recorded alongside a `failed` status; omit to keep the stored value.
 */
export async function updateMessageStatus(
  id: number,
  status: QueueStatus,
  lastError?: string,
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readwrite')
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const record = getRequest.result as QueuedMessage | undefined
      if (record === undefined) {
        db.close()
        reject(new Error(`Offline queue message ${id} not found`))
        return
      }
      record.status = status
      if (lastError !== undefined) record.lastError = lastError
      const putRequest = store.put(record)
      putRequest.onsuccess = () => { resolve(); db.close() }
      putRequest.onerror = () => { reject(putRequest.error ?? new Error('Failed to update offline message')); db.close() }
    }
    getRequest.onerror = () => { reject(getRequest.error ?? new Error('Failed to read offline message')) }
  })
}

/**
 * Remove a successfully-sent message from the queue.
 * @param id - IndexedDB key of the queued message.
 */
export async function removeMessage(id: number): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readwrite')
    const request = store.delete(id)
    request.onsuccess = () => { resolve(); db.close() }
    request.onerror = () => { reject(request.error ?? new Error('Failed to remove offline message')); db.close() }
  })
}

/**
 * Count pending messages.
 * @returns number of queued messages still awaiting a drain attempt.
 */
export async function countPending(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readonly')
    const index = store.index('status')
    const request = index.count(IDBKeyRange.only('pending'))
    request.onsuccess = () => { resolve(request.result); db.close() }
    request.onerror = () => { reject(request.error ?? new Error('Failed to count offline queue')); db.close() }
  })
}

/**
 * Remove all messages for a given session (e.g., when session is archived).
 * @param sessionId - session whose queued messages are deleted.
 */
export async function removeSessionMessages(sessionId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = storeTransaction(db, 'readwrite')
    const index = store.index('sessionId')
    const range = IDBKeyRange.only(sessionId)
    const request = index.openCursor(range)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor !== null) {
        cursor.delete()
        cursor.continue()
      } else {
        db.close()
        resolve()
      }
    }
    request.onerror = () => { reject(request.error ?? new Error('Failed to clear offline queue for session')); db.close() }
  })
}

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
export async function drainQueue(handler: DrainHandler): Promise<number> {
  const pending = await getPendingMessages()
  if (pending.length === 0) return 0

  let drained = 0
  for (const message of pending) {
    if (message.id === undefined) continue
    try {
      await updateMessageStatus(message.id, 'sending')
      await handler(message)
      await removeMessage(message.id)
      drained++
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      await updateMessageStatus(message.id, 'failed', errMsg)
      console.warn(`[offline-queue] drain failed for message ${message.id}: ${errMsg}`)
    }
  }
  return drained
}

/**
 * Cordis service face of the offline queue: enqueue outbound messages while
 * the browser is offline and replay them when the connection returns.
 */
export interface OfflineQueueService {
  enqueue: typeof enqueueMessage
  pendingCount: typeof countPending
  /**
   * Register the handler that sends one queued message during a drain.
   * @param handler - sends one queued message; a throw marks it `failed`.
   * @returns disposer that unregisters this handler.
   */
  registerDrainHandler(handler: DrainHandler): () => void
  /**
   * Replay every pending message through the registered handler in FIFO order.
   * @returns count of successfully drained messages; 0 without a handler.
   */
  drain(): Promise<number>
}

/**
 * Create the Cordis offline-queue service. The caller wires it into the
 * context via `ctx.provide('offlineQueue', service)` and triggers
 * `service.drain()` when the browser reports online.
 * @returns the service instance to provide as `ctx.offlineQueue`.
 */
export function createOfflineQueueService(): OfflineQueueService {
  let drainHandler: DrainHandler | null = null

  return {
    enqueue: enqueueMessage,
    pendingCount: countPending,
    registerDrainHandler(handler: DrainHandler): () => void {
      drainHandler = handler
      return () => { if (drainHandler === handler) drainHandler = null }
    },
    async drain(): Promise<number> {
      const handler = drainHandler
      if (handler === null) return 0
      return drainQueue(handler)
    },
  }
}
