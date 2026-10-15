/**
 * Type declarations for @deepseek-ai/dsh-llm-xingrui.
 *
 * @module @deepseek-ai/dsh-llm-xingrui
 */

import type { Context } from "@deepseek-ai/cordis";

export const name: "dsh-llm-xingrui";
export const inject: [];

/** LLM API path patterns that trigger header interception. */
export const LLM_PATHS: readonly ["/v1/messages", "/v1/chat/completions"];

/** Detect whether a URL targets a known LLM API endpoint. */
export function isLlmPath(url: string | URL | Request): boolean;

/**
 * Extract the raw API Key from any of the three standard Headers formats.
 *
 * Priority: x-api-key > Authorization (case-insensitive).
 * Returns `undefined` when headers is null/undefined or no key is found.
 */
export function extractKey(
  headers:
    | Headers
    | Record<string, string>
    | Array<[string, string]>
    | undefined
    | null,
): string | undefined;

/**
 * Rewrite headers to inject `Authorization: Bearer <key>` and remove `x-api-key`.
 * Returns the same type as input — never mutates callers' objects except for
 * WHATWG `Headers` (which are designed to be mutable).
 */
export function normalizeHeaders(
  origHeaders: Headers,
  key: string,
): Headers;
export function normalizeHeaders(
  origHeaders: Record<string, string>,
  key: string,
): Record<string, string>;
export function normalizeHeaders(
  origHeaders: Array<[string, string]>,
  key: string,
): Array<[string, string]>;

/** Enumerate header key names (not values) for debug logging. */
export function headerKeyNames(
  headers: Headers | Record<string, string> | Array<[string, string]>,
): string[];

/** Cordis plugin entry — replaces globalThis.fetch with header-normalising wrapper. */
export function apply(ctx: Context): void;