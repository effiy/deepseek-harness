/**
 * Test-local in-memory IndexedDB double for the offline-queue spec.
 *
 * Implements exactly the surface `offline-queue.ts` exercises: versioned open
 * with the one-shot create-on-upgrade path, an auto-increment store keyed by
 * `id` with the sessionId/createdAt/status indexes, add/get/put/delete, index
 * getAll/count/openCursor, and IDBKeyRange.only. Records are structured-cloned
 * at the store boundary and request callbacks fire on the microtask queue,
 * matching the real asynchronous event semantics; programmable one-shot faults
 * drive every onerror arm. Not a general-purpose IndexedDB emulation: the
 * double's signatures cover the call shapes the module uses while extra
 * runtime arguments (the open version, createObjectStore options) are ignored,
 * a repeat open reuses the live database object without firing upgradeneeded,
 * and connection close state is counted but never enforced.
 */
import type { QueuedMessage } from '../src/client/offline-queue.ts'

/** Database name the queue module opens; the double keeps one database per name. */
const DB_NAME = 'dsh-offline-messages'

/** A stored outbox record: the queued message with its injected auto-increment key. */
export type StoredMessage = QueuedMessage & { id: number }

/** A pending request whose outcome handlers the module under test attaches. */
export interface FakeIdbRequest<TResult = unknown> {
  /** Value delivered to onsuccess; `undefined` until the request settles. */
  result: TResult | undefined
  /** Error delivered to onerror; `null` until the request settles. */
  error: Error | null
  /** Success handler; invoked with no event argument. */
  onsuccess: (() => void) | null
  /** Error handler; invoked with no event argument. */
  onerror: (() => void) | null
  /** Upgrade handler; invoked before onsuccess on first creation only. */
  onupgradeneeded: (() => void) | null
  /** Blocked handler; invoked instead of settling the request. */
  onblocked: (() => void) | null
}

/** Programmable one-shot failure for the next matching store or index operation. */
export interface FakeFault {
  /** Operation name: add, get, put, delete, getAll, count, or openCursor. */
  method: string
  /** Error the request reports; `null` exercises the caller's fallback arm. */
  error: Error | null
}

/** Programmable one-shot failure for the next open() call. */
export interface FakeOpenFault {
  /** 'error' fires onerror; 'blocked' fires onblocked. */
  kind: 'error' | 'blocked'
  /** Error the open request reports; only meaningful for kind 'error'. */
  error?: Error | null
}

/** IDBKeyRange.only stand-in: the single range form the queue module builds. */
export class FakeKeyRange {
  /** Exact-match value the index filters records on. */
  readonly value: unknown

  private constructor(value: unknown) {
    this.value = value
  }

  /**
   * Build an exact-match range.
   * @param value - key value the range matches.
   * @returns range filtering records whose indexed field equals `value`.
   */
  static only(value: unknown): FakeKeyRange {
    return new FakeKeyRange(value)
  }
}

/** Cursor stand-in over one index match. */
interface FakeCursor {
  /** Remove the record the cursor points at. */
  delete(): void
  /** Advance to the next match, re-firing the owning request's onsuccess. */
  continue(): void
}

function createRequest<TResult>(): FakeIdbRequest<TResult> {
  return {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null,
  }
}

function succeed<TResult>(request: FakeIdbRequest<TResult>, result: TResult): void {
  queueMicrotask(() => {
    request.result = result
    request.onsuccess?.()
  })
}

function fail<TResult>(request: FakeIdbRequest<TResult>, error: Error | null): void {
  queueMicrotask(() => {
    request.error = error
    request.onerror?.()
  })
}

interface IndexDefinition {
  keyPath: keyof QueuedMessage
}

interface StoreData {
  records: Map<number, StoredMessage>
  indexes: Map<string, IndexDefinition>
  nextKey: number
}

class FakeIndex {
  constructor(
    private readonly owner: FakeIndexedDb,
    private readonly data: StoreData,
    private readonly keyPath: keyof QueuedMessage,
  ) {}

  private matching(range: FakeKeyRange): StoredMessage[] {
    const matches: StoredMessage[] = []
    for (const record of this.data.records.values()) {
      if (record[this.keyPath] === range.value) matches.push(record)
    }
    return matches
  }

  getAll(range: FakeKeyRange): FakeIdbRequest<StoredMessage[]> {
    const request = createRequest<StoredMessage[]>()
    const fault = this.owner.consumeFault('getAll')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    succeed(request, this.matching(range).map(record => structuredClone(record)))
    return request
  }

  count(range: FakeKeyRange): FakeIdbRequest<number> {
    const request = createRequest<number>()
    const fault = this.owner.consumeFault('count')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    succeed(request, this.matching(range).length)
    return request
  }

  openCursor(range: FakeKeyRange): FakeIdbRequest<FakeCursor | null> {
    const request = createRequest<FakeCursor | null>()
    const fault = this.owner.consumeFault('openCursor')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    const matched = this.matching(range)
    const records = this.data.records
    const step = (position: number): void => {
      queueMicrotask(() => {
        const entry = matched[position]
        if (entry === undefined) {
          request.result = null
          request.onsuccess?.()
          return
        }
        const key = entry.id
        request.result = {
          delete: () => {
            records.delete(key)
          },
          continue: () => {
            step(position + 1)
          },
        }
        request.onsuccess?.()
      })
    }
    step(0)
    return request
  }
}

class FakeObjectStore {
  constructor(private readonly owner: FakeIndexedDb, private readonly data: StoreData) {}

  createIndex(name: string, keyPath: keyof QueuedMessage): void {
    this.data.indexes.set(name, { keyPath })
  }

  add(value: QueuedMessage): FakeIdbRequest<number> {
    const request = createRequest<number>()
    const fault = this.owner.consumeFault('add')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    const key = this.data.nextKey
    this.data.nextKey += 1
    this.data.records.set(key, { ...structuredClone(value), id: key })
    succeed(request, key)
    return request
  }

  get(key: number): FakeIdbRequest<StoredMessage | undefined> {
    const request = createRequest<StoredMessage | undefined>()
    const fault = this.owner.consumeFault('get')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    const record = this.data.records.get(key)
    succeed(request, record === undefined ? undefined : structuredClone(record))
    return request
  }

  put(value: QueuedMessage): FakeIdbRequest<undefined> {
    const request = createRequest<undefined>()
    const fault = this.owner.consumeFault('put')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    if (value.id === undefined) throw new Error('FakeIndexedDb: put requires the id keyPath value')
    const key = value.id
    this.data.records.set(key, { ...structuredClone(value), id: key })
    succeed(request, undefined)
    return request
  }

  delete(key: number): FakeIdbRequest<undefined> {
    const request = createRequest<undefined>()
    const fault = this.owner.consumeFault('delete')
    if (fault !== null) {
      fail(request, fault.error)
      return request
    }
    this.data.records.delete(key)
    succeed(request, undefined)
    return request
  }

  index(name: string): FakeIndex {
    const definition = this.data.indexes.get(name)
    if (definition === undefined) throw new Error(`FakeIndexedDb: unknown index ${name}`)
    return new FakeIndex(this.owner, this.data, definition.keyPath)
  }
}

class FakeDatabase {
  /** Stores created through createObjectStore, by name. */
  readonly stores = new Map<string, StoreData>()

  /** objectStoreNames.contains stand-in over the created stores. */
  readonly objectStoreNames = {
    contains: (name: string): boolean => this.stores.has(name),
  }

  constructor(private readonly owner: FakeIndexedDb) {}

  createObjectStore(name: string): FakeObjectStore {
    const data: StoreData = { records: new Map(), indexes: new Map(), nextKey: 1 }
    this.stores.set(name, data)
    return new FakeObjectStore(this.owner, data)
  }

  transaction(name: string): { objectStore(storeName: string): FakeObjectStore } {
    if (!this.stores.has(name)) throw new Error(`FakeIndexedDb: unknown object store ${name}`)
    return {
      objectStore: (storeName: string): FakeObjectStore => {
        const data = this.stores.get(storeName)
        if (data === undefined) throw new Error(`FakeIndexedDb: unknown object store ${storeName}`)
        return new FakeObjectStore(this.owner, data)
      },
    }
  }

  close(): void {
    this.owner.noteClose()
  }
}

/** The programmable IndexedDB global: databases, faults, and the test-only record view. */
export class FakeIndexedDb {
  /** One-shot fault for the next open(); consumed by that call. */
  openFault: FakeOpenFault | null = null
  /** One-shot fault for the next store or index operation with a matching method. */
  opFault: FakeFault | null = null

  private readonly databases = new Map<string, FakeDatabase>()
  private totalCloses = 0

  /**
   * Consume the pending operation fault when its method matches.
   * @param method - operation name about to run.
   * @returns the matched fault, or null when no fault applies.
   */
  consumeFault(method: string): FakeFault | null {
    const fault = this.opFault
    if (fault === null || fault.method !== method) return null
    this.opFault = null
    return fault
  }

  /** Record one connection close; called by the database handles. */
  noteClose(): void {
    this.totalCloses += 1
  }

  /** @returns total connection closes since the last reset. */
  closeCount(): number {
    return this.totalCloses
  }

  /**
   * Open (or create) a database. First creation fires onupgradeneeded with
   * `result` already set, then onsuccess; a repeat open fires onsuccess only.
   * @param name - database name.
   * @returns request delivering the live database object.
   */
  open(name: string): FakeIdbRequest {
    const request = createRequest<FakeDatabase>()
    const fault = this.openFault
    this.openFault = null
    queueMicrotask(() => {
      if (fault !== null && fault.kind === 'blocked') {
        request.onblocked?.()
        return
      }
      if (fault !== null && fault.kind === 'error') {
        request.error = fault.error ?? null
        request.onerror?.()
        return
      }
      let database = this.databases.get(name)
      if (database === undefined) {
        database = new FakeDatabase(this)
        this.databases.set(name, database)
        request.result = database
        request.onupgradeneeded?.()
      }
      request.result = database
      request.onsuccess?.()
    })
    return request
  }

  /**
   * Test-only view of one store's live records in insertion order.
   * @param storeName - store to read; defaults to the outbox.
   * @returns cloned records; empty when the database or store does not exist.
   */
  dump(storeName = 'outbox'): StoredMessage[] {
    const store = this.databases.get(DB_NAME)?.stores.get(storeName)
    if (store === undefined) return []
    return [...store.records.values()].map(record => structuredClone(record))
  }

  /** Drop every database and clear pending faults and counters. */
  reset(): void {
    this.databases.clear()
    this.openFault = null
    this.opFault = null
    this.totalCloses = 0
  }
}
