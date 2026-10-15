/**
 * dsh-llm-xingrui — Zero-config Cordis plugin that transparently normalises
 * LLM API authentication headers at the globalThis.fetch layer.
 *
 * Any Provider → fetch(url, opts) → patchedFetch:
 *   1. isLlmPath? → early return if not
 *   2. extractKey(headers) — from x-api-key | Authorization
 *   3. normalizeHeaders → inject Authorization: Bearer, remove x-api-key
 *   4. log → structured ctx.logger output (key truncated to first 8 chars)
 *   5. originalFetch.call(this, url, opts)
 *
 * @module @deepseek-ai/dsh-llm-xingrui
 */

import { extractKey, headerKeyNames, isLlmPath, normalizeHeaders } from "./core.js";

export const name = "dsh-llm-xingrui";
export const inject = [];

/**
 * Cordis plugin entry point — replaces globalThis.fetch with a patched version
 * that normalises LLM API authentication headers.
 *
 * @param {import("@deepseek-ai/cordis").Context} ctx - Cordis plugin context
 */
export function apply(ctx) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = function patchedFetch(url, options) {
    if (!isLlmPath(url)) {
      return originalFetch.call(this, url, options);
    }

    const urlStr = typeof url === "string" ? url : url?.url ?? url?.toString?.() ?? "";

    // Debug: enumerate header keys (not values) present on this request
    const keys = options?.headers ? headerKeyNames(options.headers) : [];
    ctx.logger.info(
      `global-llm-headers: intercept ${urlStr}, header keys: [${keys.join(", ")}]`,
    );

    const key = extractKey(options?.headers);
    if (!key) {
      ctx.logger.info("global-llm-headers: NO KEY FOUND, passing through");
      return originalFetch.call(this, url, options);
    }

    const truncated = key.length > 8 ? key.slice(0, 8) + "..." : key + "...";
    ctx.logger.info(`global-llm-headers: extracted key = ${truncated}`);

    // Shallow-copy options so the caller's object is never mutated
    const opts = { ...options };
    opts.headers = normalizeHeaders(options.headers, key);

    ctx.logger.info(
      "global-llm-headers: added Authorization: Bearer, removed x-api-key",
    );

    return originalFetch.call(this, url, opts);
  };

  ctx.on("dispose", () => {
    globalThis.fetch = originalFetch;
  });

  ctx.logger.info(
    "global-llm-headers: adding Authorization: Bearer to all LLM API calls",
  );
}