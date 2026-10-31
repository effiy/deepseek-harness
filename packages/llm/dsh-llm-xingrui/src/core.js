/**
 * Pure-function core for dsh-llm-xingrui: extractKey / isLlmPath / normalizeHeaders.
 * Zero side effects — every export is independently unit-testable.
 *
 * @module @deepseek-ai/dsh-llm-xingrui/core
 */

/** LLM API path patterns matched via substring `includes`. */
export const LLM_PATHS = ["/v1/messages", "/v1/chat/completions"];

/**
 * Detect whether a URL targets a known LLM API endpoint.
 * Supports `string` and `URL` objects; `Request` objects use `.url`.
 *
 * @param {string | URL | Request} url - fetch first argument
 * @returns {boolean}
 */
export function isLlmPath(url) {
  // Request objects carry the URL in their .url property
  const urlStr = typeof url === "string"
    ? url
    : url instanceof URL
      ? url.toString()
      : url?.url ?? "";
  return LLM_PATHS.some((p) => urlStr.includes(p));
}

/**
 * Extract the raw API Key from any of the three standard Headers formats.
 *
 * Priority: x-api-key > Authorization (by PRD ADR-004).
 * x-api-key wins regardless of declaration order (two-pass for objects/arrays).
 *
 * @param {Headers | Record<string, string> | Array<[string, string]> | undefined | null} headers
 * @returns {string | undefined} raw key value, or undefined if no key found
 */
export function extractKey(headers) {
  if (!headers) return undefined;

  // Branch 1: WHATWG Headers object (instanceof check runs first)
  if (headers instanceof Headers) {
    const xApiKey = headers.get("x-api-key");
    if (xApiKey) return xApiKey;
    const auth = headers.get("authorization");
    if (auth) return auth.replace(/^Bearer\s+/i, "").trim();
    return undefined;
  }

  // Branch 2: plain object literal
  if (typeof headers === "object" && !Array.isArray(headers)) {
    // First pass: x-api-key (case-insensitive)
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "x-api-key") return String(v).trim();
    }
    // Second pass: authorization
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "authorization") {
        return String(v).replace(/^Bearer\s+/i, "").trim();
      }
    }
    return undefined;
  }

  // Branch 3: key-value pair array
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (k.toLowerCase() === "x-api-key") return String(v).trim();
    }
    for (const [k, v] of headers) {
      if (k.toLowerCase() === "authorization") {
        return String(v).replace(/^Bearer\s+/i, "").trim();
      }
    }
    return undefined;
  }

  return undefined;
}

/**
 * Rewrite headers to inject `Authorization: Bearer <key>` and remove `x-api-key`.
 * Returns a new headers representation — never mutates the original.
 *
 * @param {Headers | Record<string, string> | Array<[string, string]>} origHeaders
 * @param {string} key - raw API Key value
 * @returns {Headers | Record<string, string> | Array<[string, string]>}
 */
export function normalizeHeaders(origHeaders, key) {
  // Strategy A: Headers object — mutate in place (WHATWG Headers are mutable)
  if (origHeaders instanceof Headers) {
    origHeaders.set("authorization", `Bearer ${key}`);
    origHeaders.delete("x-api-key");
    return origHeaders;
  }

  // Strategy B: plain object — shallow copy + delete both case variants
  if (typeof origHeaders === "object" && !Array.isArray(origHeaders)) {
    const copy = { ...origHeaders, authorization: `Bearer ${key}` };
    delete copy["x-api-key"];
    delete copy["X-Api-Key"];
    return copy;
  }

  // Strategy C: array — filter old auth headers + append new
  if (Array.isArray(origHeaders)) {
    const filtered = origHeaders.filter(
      ([k]) => k.toLowerCase() !== "authorization" && k.toLowerCase() !== "x-api-key",
    );
    return [...filtered, ["authorization", `Bearer ${key}`]];
  }

  return origHeaders;
}

/**
 * Enumerate header key names (not values) for debug logging.
 *
 * @param {Headers | Record<string, string> | Array<[string, string]>} headers
 * @returns {string[]}
 */
export function headerKeyNames(headers) {
  if (headers instanceof Headers) {
    return [...headers.keys()];
  }
  if (typeof headers === "object" && !Array.isArray(headers)) {
    return Object.keys(headers);
  }
  if (Array.isArray(headers)) {
    return headers.map(([k]) => k);
  }
  return [];
}