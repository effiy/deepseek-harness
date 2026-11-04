/**
 * Retry-aware fetch wrapper for the browser RPC transport.
 *
 * Applies exponential backoff to transient failures (network errors, 5xx,
 * 429 rate-limiting). Client errors (4xx) are not retried — the request
 * itself is the cause, not the network.
 *
 * Default: 3 retries, delays 1s → 2s → 4s, with full jitter (±25 %).
 */

import type { RpcFetch } from './rpc.ts'

/** Tunable retry policy (partial = only override what you need). */
export interface FetchRetryPolicy {
  /** Maximum retries (default 3). Set 0 to disable. */
  maxRetries?: number
  /** Base delay in ms for the first retry (default 1_000). */
  baseDelayMs?: number
  /** Growth factor per attempt (default 2: 1s, 2s, 4s). */
  factor?: number
  /**
   * Extra status codes to retry (added to the built-in set: 5xx, 429).
   * Use empty to keep only the built-in set.
   */
  retryStatusCodes?: number[]
}

/** Full resolved policy with every field filled. */
export interface ResolvedFetchRetryPolicy {
  readonly maxRetries: number
  readonly baseDelayMs: number
  readonly factor: number
  readonly retryStatusCodes: ReadonlySet<number>
}

const BUILT_IN_RETRY_CODES = new Set<number>(
  Array.from({ length: 100 }, (_, i) => 500 + i), // 500–599
)

const BUILT_IN_RETRY_EXTRA = new Set([429])

function buildRetryCodes(extra?: number[]): Set<number> {
  const set = new Set(BUILT_IN_RETRY_CODES)
  for (const code of BUILT_IN_RETRY_EXTRA) set.add(code)
  if (extra !== undefined) {
    for (const code of extra) set.add(code)
  }
  return set
}

/** Default policy consumed by callers that omit configuration. */
export const DEFAULT_RETRY_POLICY: ResolvedFetchRetryPolicy = Object.freeze({
  maxRetries: 3,
  baseDelayMs: 1_000,
  factor: 2,
  retryStatusCodes: buildRetryCodes(),
})

function resolvePolicy(partial?: FetchRetryPolicy): ResolvedFetchRetryPolicy {
  if (partial === undefined) return DEFAULT_RETRY_POLICY
  const maxRetries = partial.maxRetries ?? 3
  const baseDelayMs = partial.baseDelayMs ?? 1_000
  const factor = partial.factor ?? 2
  return Object.freeze({
    maxRetries,
    baseDelayMs,
    factor,
    retryStatusCodes: buildRetryCodes(partial.retryStatusCodes),
  })
}

/**
 * Returns true when the error is retryable: network failures (TypeError from
 * fetch when offline) or retry-status HTTP responses.
 */
function isRetryable(error: unknown, codes: ReadonlySet<number>): boolean {
  // Network error: fetch rejects with TypeError when offline or DNS fails.
  if (error instanceof TypeError) return true
  // DOMException with 'AbortError' name is an explicit cancellation — do not retry.
  if (error instanceof DOMException) return false
  // Response with a retryable status.
  if (error instanceof Response || (isRecord(error) && typeof (error as Record<string, unknown>).status === 'number')) {
    return codes.has((error as { status: number }).status)
  }
  return false
}

/** Exponential delay with jitter: delay * (0.75 … 1.25). */
function jitteredDelay(baseDelayMs: number, attempt: number, factor: number): number {
  const raw = baseDelayMs * factor ** attempt
  const low = Math.round(raw * 0.75)
  const high = Math.round(raw * 1.25)
  return low + Math.floor(Math.random() * (high - low + 1))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const t = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(t)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Wrap a fetch-like function with automatic retry on transient failures.
 *
 * @param fetchImpl - The underlying fetch (or RpcFetch) to decorate.
 * @param partialPolicy - Retry timing overrides; absent uses defaults.
 * @returns A decorated fetch with the same signature.
 */
export function createRetryFetch(
  fetchImpl: RpcFetch,
  partialPolicy?: FetchRetryPolicy,
): RpcFetch {
  const policy = resolvePolicy(partialPolicy)

  return async (input: string | URL, init: RequestInit): Promise<Response> => {
    const signal = init.signal
    let lastError: unknown

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      // Check cancellation before each attempt (including the first).
      if (signal?.aborted) throw signal.reason

      try {
        const response = await fetchImpl(input, init)
        // Successful response or non-retryable status.
        if (response.ok || !policy.retryStatusCodes.has(response.status)) {
          return response
        }
        // Retryable status (5xx, 429) — throw to enter the catch path.
        lastError = response
      } catch (error: unknown) {
        lastError = error
        if (!isRetryable(error, policy.retryStatusCodes)) throw error
      }

      // Last attempt — give up.
      if (attempt === policy.maxRetries) break

      const delay = jitteredDelay(policy.baseDelayMs, attempt, policy.factor)
      console.warn(
        `[retry-fetch] attempt ${attempt + 1}/${policy.maxRetries} failed, retrying in ${delay}ms`,
        typeof input === 'string' ? input : input.href,
      )
      await sleep(delay, signal ?? undefined)
    }

    // All retries exhausted.
    throw lastError instanceof Error
      ? lastError
      : new Error(`fetch failed after ${policy.maxRetries + 1} attempts`)
  }
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
