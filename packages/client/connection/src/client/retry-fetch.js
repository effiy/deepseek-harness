/**
 * Retry-aware fetch wrapper for the browser RPC transport.
 *
 * Applies exponential backoff to transient failures (network errors, 5xx,
 * 429 rate-limiting). Client errors (4xx) are not retried — the request
 * itself is the cause, not the network.
 *
 * Default: 3 retries, delays 1s → 2s → 4s, with full jitter (±25 %).
 */
const BUILT_IN_RETRY_CODES = new Set(Array.from({ length: 100 }, (_, i) => 500 + i));
const BUILT_IN_RETRY_EXTRA = new Set([429]);
function buildRetryCodes(extra) {
    const set = new Set(BUILT_IN_RETRY_CODES);
    for (const code of BUILT_IN_RETRY_EXTRA)
        set.add(code);
    if (extra !== undefined) {
        for (const code of extra)
            set.add(code);
    }
    return set;
}
/** Default policy consumed by callers that omit configuration. */
export const DEFAULT_RETRY_POLICY = Object.freeze({
    maxRetries: 3,
    baseDelayMs: 1_000,
    factor: 2,
    retryStatusCodes: buildRetryCodes(),
});
function resolvePolicy(partial) {
    if (partial === undefined)
        return DEFAULT_RETRY_POLICY;
    const maxRetries = partial.maxRetries ?? 3;
    const baseDelayMs = partial.baseDelayMs ?? 1_000;
    const factor = partial.factor ?? 2;
    return Object.freeze({
        maxRetries,
        baseDelayMs,
        factor,
        retryStatusCodes: buildRetryCodes(partial.retryStatusCodes),
    });
}
/**
 * Returns true when the error is retryable: network failures (TypeError from
 * fetch when offline) or retry-status HTTP responses.
 */
function isRetryable(error, codes) {
    // Network error: fetch rejects with TypeError when offline or DNS fails.
    if (error instanceof TypeError)
        return true;
    // DOMException with 'AbortError' name is an explicit cancellation — do not retry.
    if (error instanceof DOMException)
        return false;
    // Response with a retryable status.
    if (error instanceof Response || (isRecord(error) && typeof error.status === 'number')) {
        return codes.has(error.status);
    }
    return false;
}
/** Exponential delay with jitter: delay * (0.75 … 1.25). */
function jitteredDelay(baseDelayMs, attempt, factor) {
    const raw = baseDelayMs * factor ** attempt;
    const low = Math.round(raw * 0.75);
    const high = Math.round(raw * 1.25);
    return low + Math.floor(Math.random() * (high - low + 1));
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason);
            return;
        }
        const t = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(signal?.reason);
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
/**
 * Wrap a fetch-like function with automatic retry on transient failures.
 *
 * @param fetchImpl - The underlying fetch (or RpcFetch) to decorate.
 * @param partialPolicy - Retry timing overrides; absent uses defaults.
 * @returns A decorated fetch with the same signature.
 */
export function createRetryFetch(fetchImpl, partialPolicy) {
    const policy = resolvePolicy(partialPolicy);
    return async (input, init) => {
        const signal = init.signal;
        let lastError;
        for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
            // Check cancellation before each attempt (including the first).
            if (signal?.aborted)
                throw signal.reason;
            try {
                const response = await fetchImpl(input, init);
                // Successful response or non-retryable status.
                if (response.ok || !policy.retryStatusCodes.has(response.status)) {
                    return response;
                }
                // Retryable status (5xx, 429) — throw to enter the catch path.
                lastError = response;
            }
            catch (error) {
                lastError = error;
                if (!isRetryable(error, policy.retryStatusCodes))
                    throw error;
            }
            // Last attempt — give up.
            if (attempt === policy.maxRetries)
                break;
            const delay = jitteredDelay(policy.baseDelayMs, attempt, policy.factor);
            console.warn(`[retry-fetch] attempt ${attempt + 1}/${policy.maxRetries} failed, retrying in ${delay}ms`, typeof input === 'string' ? input : input.href);
            await sleep(delay, signal);
        }
        // All retries exhausted.
        throw lastError instanceof Error
            ? lastError
            : new Error(`fetch failed after ${policy.maxRetries + 1} attempts`);
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=retry-fetch.js.map