/** Retry-aware fetch decoration: retryable classification, jittered backoff, abort, and exhaustion contract. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryFetch, DEFAULT_RETRY_POLICY } from '../src/client/retry-fetch.ts'
import type { RpcFetch } from '../src/client/rpc.ts'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Silence and count the retry warnings so specs assert timing, not logs. */
function watchRetries(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined)
}

describe('createRetryFetch', () => {
  it('pins the default policy: three retries over 5xx and 429', () => {
    expect(DEFAULT_RETRY_POLICY).toMatchObject({ maxRetries: 3, baseDelayMs: 1_000, factor: 2 })
    for (const status of [500, 503, 599, 429]) expect(DEFAULT_RETRY_POLICY.retryStatusCodes.has(status)).toBe(true)
    expect(DEFAULT_RETRY_POLICY.retryStatusCodes.has(404)).toBe(false)
    expect(DEFAULT_RETRY_POLICY.retryStatusCodes.has(600)).toBe(false)
  })

  it('returns an ok response without retrying', async () => {
    const fetch = vi.fn<RpcFetch>().mockResolvedValue(new Response('ok', { status: 200 }))
    const response = await createRetryFetch(fetch)('api/x', {})
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns a non-retryable status response immediately', async () => {
    const warn = watchRetries()
    const fetch = vi.fn<RpcFetch>().mockResolvedValue(new Response('nope', { status: 404 }))
    const response = await createRetryFetch(fetch)('api/x', {})
    expect(response.status).toBe(404)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('retries a retryable status with jittered backoff and returns the final response when exhausted', async () => {
    vi.useFakeTimers()
    const warn = watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetch = vi.fn<RpcFetch>().mockResolvedValue(new Response('unavailable', { status: 503 }))
    const send = createRetryFetch(fetch, { maxRetries: 2, baseDelayMs: 100 })
    const pending = send(new URL('https://host.example/api/x'), {})
    await vi.advanceTimersByTimeAsync(74)
    expect(fetch).toHaveBeenCalledTimes(1)
    // attempt 0 backoff: round(100 * 0.75) at zero jitter.
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    // attempt 1 backoff: round(100 * 2 * 0.75).
    await vi.advanceTimersByTimeAsync(150)
    const exhausted = await pending
    expect(exhausted.status).toBe(503)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('attempt 1/2'), 'https://host.example/api/x')
  })

  it('returns the recovery response when a retry succeeds', async () => {
    vi.useFakeTimers()
    watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const fetch = vi.fn<RpcFetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const send = createRetryFetch(fetch, { maxRetries: 2, baseDelayMs: 100 })
    const pending = send('api/x', {})
    // Full jitter ceiling for attempt 0: round(100 * 1.25).
    await vi.advanceTimersByTimeAsync(124)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await pending).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('retries a network TypeError with policy defaults and rethrows the final error', async () => {
    vi.useFakeTimers()
    watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const failure = new TypeError('network down')
    const fetch = vi.fn<RpcFetch>().mockRejectedValue(failure)
    const send = createRetryFetch(fetch, { baseDelayMs: 10 })
    const rejection = expect(send('api/x', {})).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(1_000)
    await rejection
    // maxRetries and factor fall back to defaults: four attempts total.
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('rethrows non-retryable thrown values without a second attempt', async () => {
    const plain = new Error('boom')
    const abortLike = new DOMException('aborted', 'AbortError')
    const clientStatus = { status: 404 }
    for (const failure of [plain, abortLike, clientStatus]) {
      const fetch = vi.fn<RpcFetch>().mockRejectedValue(failure)
      await expect(createRetryFetch(fetch)('api/x', {})).rejects.toBe(failure)
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  })

  it('reports attempt exhaustion when a retryable record outlives the retries', async () => {
    vi.useFakeTimers()
    watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetch = vi.fn<RpcFetch>().mockRejectedValue({ status: 502 })
    const send = createRetryFetch(fetch, { maxRetries: 1, baseDelayMs: 10 })
    const rejection = expect(send('api/x', {})).rejects.toThrow('fetch failed after 2 attempts')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('hands a rejected retryable Response back to the caller with zero retries', async () => {
    const rejected = new Response('unavailable', { status: 503 })
    const fetch = vi.fn<RpcFetch>().mockRejectedValue(rejected)
    await expect(createRetryFetch(fetch, { maxRetries: 0 })('api/x', {})).resolves.toBe(rejected)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('extends the retryable statuses through policy', async () => {
    vi.useFakeTimers()
    watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetch = vi.fn<RpcFetch>()
      .mockResolvedValueOnce(new Response('teapot', { status: 418 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const send = createRetryFetch(fetch, { maxRetries: 1, baseDelayMs: 10, retryStatusCodes: [418] })
    const pending = send('api/x', {})
    await vi.advanceTimersByTimeAsync(8)
    expect((await pending).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws the abort reason before the first attempt when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch = vi.fn<RpcFetch>()
    const send = createRetryFetch(fetch)
    await expect(send('api/x', { signal: controller.signal })).rejects.toBe(controller.signal.reason)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects the backoff sleep when the signal aborts mid-retry', async () => {
    vi.useFakeTimers()
    watchRetries()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const controller = new AbortController()
    const reason = new Error('backoff aborted')
    const fetch = vi.fn<RpcFetch>().mockResolvedValue(new Response('unavailable', { status: 503 }))
    const send = createRetryFetch(fetch, { maxRetries: 3, baseDelayMs: 100 })
    const pending = send('api/x', { signal: controller.signal })
    const rejection = expect(pending).rejects.toBe(reason)
    await vi.advanceTimersByTimeAsync(10)
    controller.abort(reason)
    await rejection
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects before sleeping when the abort lands during the failed attempt', async () => {
    vi.useFakeTimers()
    watchRetries()
    const controller = new AbortController()
    const reason = new Error('aborted in flight')
    const fetch = vi.fn<RpcFetch>().mockImplementation(async () => {
      controller.abort(reason)
      throw new TypeError('network down')
    })
    const send = createRetryFetch(fetch, { maxRetries: 2, baseDelayMs: 100 })
    const pending = send('api/x', { signal: controller.signal })
    const rejection = expect(pending).rejects.toBe(reason)
    await vi.advanceTimersByTimeAsync(200)
    await rejection
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
