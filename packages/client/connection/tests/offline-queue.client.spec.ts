/** Offline-queue persistence, drain, and service behavior against an in-memory IndexedDB double. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countPending,
  createOfflineQueueService,
  drainQueue,
  enqueueMessage,
  getPendingMessages,
  removeMessage,
  removeSessionMessages,
  updateMessageStatus,
  type DrainHandler,
  type QueuedMessage,
} from '../src/client/offline-queue.ts'
import { FakeIndexedDb, FakeKeyRange } from './fake-indexeddb.client.ts'

const fake = new FakeIndexedDb()

/**
 * Build an enqueue input.
 * @param text - prompt text identifying the message in assertions.
 * @param sessionId - target session; defaults to `sess-a`.
 * @returns input for enqueueMessage with mode `queue`.
 */
function msg(text: string, sessionId = 'sess-a'): Omit<QueuedMessage, 'id' | 'createdAt' | 'status'> {
  return { sessionId, text, mode: 'queue' }
}

/**
 * Unwrap the generated id of an enqueued record.
 * @param message - record returned by enqueueMessage.
 * @returns the generated IndexedDB key.
 */
function idOf(message: QueuedMessage): number {
  const id = message.id
  if (id === undefined) throw new Error('spec: enqueued record lost its generated id')
  return id
}

beforeEach(() => {
  fake.reset()
  vi.stubGlobal('indexedDB', fake)
  vi.stubGlobal('IDBKeyRange', FakeKeyRange)
  // Deterministic createdAt values; faking only Date keeps the microtask
  // queue the double fires through on real scheduling.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-06T08:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('openDb', () => {
  it('rejects when the IndexedDB global is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(countPending()).rejects.toThrow('IndexedDB not available')
  })

  it('surfaces the open request error', async () => {
    fake.openFault = { kind: 'error', error: new Error('open boom') }
    await expect(countPending()).rejects.toThrow('open boom')
  })

  it('falls back when the open request carries no error', async () => {
    fake.openFault = { kind: 'error', error: null }
    await expect(countPending()).rejects.toThrow('Failed to open offline queue database')
  })

  it('reports a blocked database', async () => {
    fake.openFault = { kind: 'blocked' }
    await expect(countPending()).rejects.toThrow('Offline queue database blocked — close other tabs')
  })
})

describe('enqueueMessage', () => {
  it('stores the record with its generated id and enqueue metadata', async () => {
    const stored = await enqueueMessage({ sessionId: 'sess-a', text: 'first', mode: 'steer' })
    expect(stored).toEqual({
      id: 1,
      sessionId: 'sess-a',
      text: 'first',
      mode: 'steer',
      createdAt: '2026-11-06T08:00:00.000Z',
      status: 'pending',
    })
    vi.advanceTimersByTime(1_000)
    const second = await enqueueMessage(msg('second'))
    expect(second.id).toBe(2)
    expect(second.createdAt).toBe('2026-11-06T08:00:01.000Z')
    expect(fake.dump().map(record => record.text)).toEqual(['first', 'second'])
  })

  it('surfaces an add failure', async () => {
    fake.opFault = { method: 'add', error: new Error('quota exceeded') }
    await expect(enqueueMessage(msg('doomed'))).rejects.toThrow('quota exceeded')
  })

  it('falls back when add carries no error', async () => {
    fake.opFault = { method: 'add', error: null }
    await expect(enqueueMessage(msg('doomed'))).rejects.toThrow('Failed to enqueue offline message')
  })
})

describe('getPendingMessages', () => {
  it('returns pending messages oldest first, excluding other statuses', async () => {
    await enqueueMessage(msg('first'))
    vi.advanceTimersByTime(1_000)
    await enqueueMessage(msg('second'))
    vi.advanceTimersByTime(1_000)
    await enqueueMessage(msg('third'))
    vi.advanceTimersByTime(1_000)
    await enqueueMessage(msg('doomed'))
    await updateMessageStatus(4, 'failed', 'sent never')
    const pending = await getPendingMessages()
    expect(pending.map(message => message.text)).toEqual(['first', 'second', 'third'])
    expect(pending.map(message => message.createdAt)).toEqual([
      '2026-11-06T08:00:00.000Z',
      '2026-11-06T08:00:01.000Z',
      '2026-11-06T08:00:02.000Z',
    ])
  })

  it('surfaces a getAll failure', async () => {
    fake.opFault = { method: 'getAll', error: new Error('read boom') }
    await expect(getPendingMessages()).rejects.toThrow('read boom')
  })

  it('falls back when getAll carries no error', async () => {
    fake.opFault = { method: 'getAll', error: null }
    await expect(getPendingMessages()).rejects.toThrow('Failed to read offline queue')
  })
})

describe('updateMessageStatus', () => {
  it('updates the status and records lastError', async () => {
    const stored = await enqueueMessage(msg('payload'))
    await updateMessageStatus(idOf(stored), 'failed', 'send exploded')
    const [record] = fake.dump()
    expect(record?.status).toBe('failed')
    expect(record?.lastError).toBe('send exploded')
  })

  it('keeps the stored lastError when the argument is omitted', async () => {
    const stored = await enqueueMessage(msg('payload'))
    await updateMessageStatus(idOf(stored), 'failed', 'first boom')
    await updateMessageStatus(idOf(stored), 'sending')
    const [record] = fake.dump()
    expect(record?.status).toBe('sending')
    expect(record?.lastError).toBe('first boom')
  })

  it('rejects for a missing id', async () => {
    await enqueueMessage(msg('payload'))
    await expect(updateMessageStatus(999, 'pending')).rejects.toThrow('Offline queue message 999 not found')
  })

  it('surfaces a get failure and closes the connection', async () => {
    await enqueueMessage(msg('payload'))
    const closesBefore = fake.closeCount()
    fake.opFault = { method: 'get', error: new Error('get boom') }
    await expect(updateMessageStatus(1, 'sending')).rejects.toThrow('get boom')
    expect(fake.closeCount()).toBe(closesBefore + 1)
  })

  it('falls back when get carries no error', async () => {
    fake.opFault = { method: 'get', error: null }
    await expect(updateMessageStatus(1, 'sending')).rejects.toThrow('Failed to read offline message')
  })

  it('surfaces a put failure', async () => {
    await enqueueMessage(msg('payload'))
    fake.opFault = { method: 'put', error: new Error('put boom') }
    await expect(updateMessageStatus(1, 'sending')).rejects.toThrow('put boom')
  })

  it('falls back when put carries no error', async () => {
    await enqueueMessage(msg('payload'))
    fake.opFault = { method: 'put', error: null }
    await expect(updateMessageStatus(1, 'sending')).rejects.toThrow('Failed to update offline message')
  })
})

describe('removeMessage', () => {
  it('deletes the record and tolerates a missing key', async () => {
    const stored = await enqueueMessage(msg('payload'))
    await removeMessage(idOf(stored))
    expect(await countPending()).toBe(0)
    await expect(removeMessage(999)).resolves.toBeUndefined()
  })

  it('surfaces a delete failure', async () => {
    fake.opFault = { method: 'delete', error: new Error('delete boom') }
    await expect(removeMessage(1)).rejects.toThrow('delete boom')
  })

  it('falls back when delete carries no error', async () => {
    fake.opFault = { method: 'delete', error: null }
    await expect(removeMessage(1)).rejects.toThrow('Failed to remove offline message')
  })
})

describe('countPending', () => {
  it('counts only pending records', async () => {
    await enqueueMessage(msg('a'))
    await enqueueMessage(msg('b'))
    await enqueueMessage(msg('c'))
    await updateMessageStatus(2, 'sending')
    expect(await countPending()).toBe(2)
  })

  it('surfaces a count failure', async () => {
    fake.opFault = { method: 'count', error: new Error('count boom') }
    await expect(countPending()).rejects.toThrow('count boom')
  })

  it('falls back when count carries no error', async () => {
    fake.opFault = { method: 'count', error: null }
    await expect(countPending()).rejects.toThrow('Failed to count offline queue')
  })
})

describe('removeSessionMessages', () => {
  it('removes every message of the session and keeps others', async () => {
    await enqueueMessage(msg('a1'))
    await enqueueMessage(msg('a2'))
    await enqueueMessage(msg('b1', 'sess-b'))
    await removeSessionMessages('sess-a')
    expect(fake.dump().map(record => record.text)).toEqual(['b1'])
  })

  it('resolves when the session has no queued messages', async () => {
    await enqueueMessage(msg('a1'))
    await expect(removeSessionMessages('ghost')).resolves.toBeUndefined()
    expect(await countPending()).toBe(1)
  })

  it('surfaces an openCursor failure', async () => {
    fake.opFault = { method: 'openCursor', error: new Error('cursor boom') }
    await expect(removeSessionMessages('sess-a')).rejects.toThrow('cursor boom')
  })

  it('falls back when openCursor carries no error', async () => {
    fake.opFault = { method: 'openCursor', error: null }
    await expect(removeSessionMessages('sess-a')).rejects.toThrow('Failed to clear offline queue for session')
  })
})

describe('drainQueue', () => {
  it('returns 0 on an empty queue without calling the handler', async () => {
    const handler = vi.fn<DrainHandler>()
    expect(await drainQueue(handler)).toBe(0)
    expect(handler).not.toHaveBeenCalled()
  })

  it('replays pending messages FIFO, marks sending first, and removes them', async () => {
    await enqueueMessage(msg('first'))
    vi.advanceTimersByTime(1_000)
    await enqueueMessage(msg('second'))
    const order: string[] = []
    const handler = vi.fn<DrainHandler>(async (message) => {
      order.push(message.text)
      const stored = fake.dump().find(record => record.id === message.id)
      expect(stored?.status).toBe('sending')
    })
    expect(await drainQueue(handler)).toBe(2)
    expect(order).toEqual(['first', 'second'])
    expect(fake.dump()).toEqual([])
  })

  it('marks a failed send, warns, and continues with the next message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await enqueueMessage(msg('doomed'))
    await enqueueMessage(msg('lucky'))
    const handler = vi.fn<DrainHandler>(async (message) => {
      if (message.text === 'doomed') throw new Error('send boom')
    })
    expect(await drainQueue(handler)).toBe(1)
    const [record] = fake.dump()
    expect(record?.text).toBe('doomed')
    expect(record?.status).toBe('failed')
    expect(record?.lastError).toBe('send boom')
    expect(warn).toHaveBeenCalledWith('[offline-queue] drain failed for message 1: send boom')
  })

  it('stringifies a non-Error throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await enqueueMessage(msg('doomed'))
    const handler = vi.fn<DrainHandler>(async () => {
      throw 'plain string'
    })
    expect(await drainQueue(handler)).toBe(0)
    const [record] = fake.dump()
    expect(record?.lastError).toBe('plain string')
    expect(warn).toHaveBeenCalledWith('[offline-queue] drain failed for message 1: plain string')
  })
})

describe('createOfflineQueueService', () => {
  it('exposes enqueue and pendingCount', async () => {
    const service = createOfflineQueueService()
    const stored = await service.enqueue(msg('payload'))
    expect(idOf(stored)).toBe(1)
    expect(await service.pendingCount()).toBe(1)
  })

  it('drains nothing without a registered handler', async () => {
    const service = createOfflineQueueService()
    await enqueueMessage(msg('payload'))
    expect(await service.drain()).toBe(0)
    expect(await service.pendingCount()).toBe(1)
  })

  it('drains through the registered handler', async () => {
    const service = createOfflineQueueService()
    const sent: string[] = []
    service.registerDrainHandler(async (message) => { sent.push(message.text) })
    await enqueueMessage(msg('payload'))
    expect(await service.drain()).toBe(1)
    expect(sent).toEqual(['payload'])
    expect(fake.dump()).toEqual([])
  })

  it('unregisters through the disposer', async () => {
    const service = createOfflineQueueService()
    const handler = vi.fn<DrainHandler>()
    const dispose = service.registerDrainHandler(handler)
    dispose()
    await enqueueMessage(msg('payload'))
    expect(await service.drain()).toBe(0)
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores a stale disposer after re-registration', async () => {
    const service = createOfflineQueueService()
    const first = vi.fn<DrainHandler>()
    const second = vi.fn<DrainHandler>()
    const disposeFirst = service.registerDrainHandler(first)
    service.registerDrainHandler(second)
    disposeFirst()
    await enqueueMessage(msg('payload'))
    expect(await service.drain()).toBe(1)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
