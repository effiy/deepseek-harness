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
/** Default policy consumed by callers that omit configuration. */
export declare const DEFAULT_RETRY_POLICY: ResolvedFetchRetryPolicy
/**
 * Wrap a fetch-like function with automatic retry on transient failures.
 *
 * @param fetchImpl - The underlying fetch (or RpcFetch) to decorate.
 * @param partialPolicy - Retry timing overrides; absent uses defaults.
 * @returns A decorated fetch with the same signature.
 */
export declare function createRetryFetch(fetchImpl: RpcFetch, partialPolicy?: FetchRetryPolicy): RpcFetch
//# sourceMappingURL=retry-fetch.d.ts.map
