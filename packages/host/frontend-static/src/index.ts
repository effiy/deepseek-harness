/**
 * @deepseek-ai/dsh-host-frontend-static — SPA dist server over the webserver
 * fallback seat: serves the built frontend directory with explicit index
 * entry points. A readable index renders at the dist root and configured index
 * path; missing paths return 404, traversal outside the dist root is 403,
 * unknown extensions ship as octet-stream, and non-GET/HEAD is 405. Every
 * index response first passes Connection's browser authentication, then the
 * webserver's index render (structured injection rows, then raw taps).
 * Non-index assets stay public. The dist location is workspace knowledge of
 * the composing application, so `distIndex` is typically supplied through a
 * `!!js` expression, never hardcoded by a deployment.
 * @module @deepseek-ai/dsh-host-frontend-static
 */

import type { ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'frontend-static'

/** Services required before the authenticated fallback seat can be claimed. */
export const inject = ['webServer', 'connection']

/** Plugin config: the dist anchor. */
export interface Config {
  /** Absolute path of index.html inside the dist root. */
  distIndex: string
}

export const Config: z<Config> = z.object({
  distIndex: z.string().required(),
})

const HTML_MIME = 'text/html; charset=utf-8'

const MIME: Record<string, string> = {
  '.html': HTML_MIME,
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  // The packed VFS image. Served as its own bytes, never as a Content-Encoding:
  // the worker inflates the body itself, and a transport-level encoding would
  // leave it inflating an already-decoded archive.
  '.gz': 'application/gzip',
}

const STATIC_MISS_CODES: ReadonlySet<string | undefined> = new Set([
  'ENOENT',
  'EISDIR',
  'ENOTDIR',
])

// ── Cache-Control ────────────────────────────────────────────────────────
// Versioned assets carry content hashes in their filenames (e.g.
// `index-a1b2c3d4.js`), so they can be cached indefinitely. The index page
// must never be cached stale: it carries the boot manifest and the latest
// asset references. Other assets get a conservative short-lived cache.
// Mobile browsers benefit most from immutable caching — they skip even the
// conditional revalidation round-trip on repeat visits.

/** Cache-Control for versioned assets: one year, immutable. */
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'

/** Cache-Control for the index page: always revalidate with the server. */
const CACHE_NO_CACHE = 'no-cache'

/** Cache-Control for unversioned static assets: one hour. */
const CACHE_PUBLIC_SHORT = 'public, max-age=3600'

/**
 * Whether a filename carries a build-content hash — at least 8 hex
 * characters preceded by a separator and followed by a dot-extension.
 * Matches patterns like `index-a1b2c3d4.js`, `chunk.e5f6g7h8.css`,
 * `vendor-i9j0k1l2.js.map`.
 */
const HASHED_FILENAME = /[-_.][a-f0-9]{8,}\./

// ── Pre-compressed asset serving ─────────────────────────────────────────
// Brotli compresses text assets ~20 % smaller than gzip with comparable
// decode cost. Generating `.br` and `.gz` copies at build time avoids
// per-request compression overhead — the server reads a pre-built file and
// sets Content-Encoding. Mobile radios benefit because fewer bytes cross the
// air interface. The Client signals support through Accept-Encoding; the
// server serves the best variant it has.

/**
 * Parse an Accept-Encoding header into a quality-ordered list of encoding
 * tokens. Unknown tokens are skipped; the default quality is 1.
 */
function parseAcceptEncoding(header: string | undefined): string[] {
  if (header === undefined) return []
  return header
    .split(',')
    .map(token => {
      const [name = '', qParam] = token.trim().split(';')
      const q = qParam?.trim().startsWith('q=') ? parseFloat(qParam.trim().slice(2)) : 1
      return { name: name.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 }
    })
    .filter(({ name, q }) => name.length > 0 && q > 0)
    .sort((a, b) => b.q - a.q)
    .map(({ name }) => name)
}

/** Extension appended to the original path: `.br` or `.gz`. */
type ContentEncodingExt = '' | '.br' | '.gz'

/** The IANA Content-Encoding value: `'br'` or `'gzip'`. */
type ContentEncodingValue = 'br' | 'gzip'

/** Map an Accept-Encoding token to its file extension and IANA encoding name. */
function resolveContentEncoding(token: string): { ext: ContentEncodingExt; value: ContentEncodingValue } | undefined {
  if (token === 'br') return { ext: '.br', value: 'br' }
  if (token === 'gzip' || token === 'x-gzip') return { ext: '.gz', value: 'gzip' }
  return undefined
}

/**
 * Read the best available pre-compressed variant of a static file.
 * Falls back to the uncompressed original when no variant is available
 * or when the Client accepts no supported encoding.
 * @returns the file body and optional content encoding to apply.
 */
async function readBestVariant(
  target: string,
  acceptEncoding: string | undefined,
): Promise<{ body: Buffer; contentEncoding?: ContentEncodingValue }> {
  const tokens = parseAcceptEncoding(acceptEncoding)
  for (const token of tokens) {
    const resolved = resolveContentEncoding(token)
    if (resolved === undefined) continue
    try {
      const body = await readFile(`${target}${resolved.ext}`)
      return { body, contentEncoding: resolved.value }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      // Variant absent — try the next encoding.
    }
  }
  // No pre-compressed variant found or no accepted encoding — serve original.
  return { body: await readFile(target) }
}

/**
 * Serve one GET/HEAD static request from the dist root.
 * @param pathname - decoded URL pathname of the request.
 * @param res - the node:http response to write.
 * @param distRoot - absolute dist root directory (resolved by the caller).
 * @param distIndex - absolute path of index.html inside distRoot.
 * @param authorizeIndex - authenticates an index response before its bytes are read.
 * @param renderIndex - produces the index.html body (structured injection
 * rendering) for the dist root and configured index path.
 * @param acceptEncoding - the request's Accept-Encoding header; when provided,
 * the best available pre-compressed variant is served for non-index assets.
 */
export async function serveStatic(
  pathname: string, res: ServerResponse, distRoot: string, distIndex: string,
  authorizeIndex: () => boolean,
  renderIndex: () => Promise<string>,
  acceptEncoding?: string,
): Promise<void> {
  const target = resolve(normalize(join(distRoot, pathname)))
  // Traversal rejection: the target must be distRoot itself (`/`) or stay under
  // it. `sep`, not '/': resolve() emits backslash paths on Windows, where a '/'
  // suffix would reject every legitimate subpath as traversal.
  if (target !== distRoot && !target.startsWith(distRoot + sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  let body: Buffer | string
  let type: string
  let cacheControl: string
  let contentEncoding: ContentEncodingValue | undefined
  try {
    if (target === distRoot || target === distIndex) {
      if (!authorizeIndex()) return
      body = await renderIndex()
      type = HTML_MIME
      cacheControl = CACHE_NO_CACHE
    } else {
      const variant = await readBestVariant(target, acceptEncoding)
      body = variant.body
      contentEncoding = variant.contentEncoding
      type = MIME[extname(target)] ?? 'application/octet-stream'
      cacheControl = HASHED_FILENAME.test(basename(target))
        ? CACHE_IMMUTABLE
        : CACHE_PUBLIC_SHORT
    }
  } catch (error) {
    // Only absent or non-file targets are 404; other filesystem failures reach
    // the webserver's request-failure handling.
    if (!STATIC_MISS_CODES.has((error as NodeJS.ErrnoException).code)) throw error
    res.writeHead(404)
    res.end()
    return
  }
  const headers: Record<string, string> = { 'content-type': type, 'cache-control': cacheControl }
  if (contentEncoding !== undefined) {
    headers['content-encoding'] = contentEncoding
    headers['vary'] = 'Accept-Encoding'
  }
  res.writeHead(200, headers)
  res.end(body)
}

/**
 * Claim the webserver fallback seat and serve the dist.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const distIndex = config.distIndex
  const distRoot = dirname(distIndex)
  // Insert after all index transforms so the base precedes every resource reference.
  const renderIndex = async (): Promise<string> => {
    const body = ctx.webServer.renderIndex(await readFile(distIndex, 'utf8'))
    return body.replace(/<head(?:\s[^>]*)?>/i, open => `${open}<base href="./">`)
  }
  ctx.effect(() => ctx.webServer.registerFallback(async (req, res) => {
    // Non-GET/HEAD without a matching named route is 405 (fallback-only
    // semantics: named routes own their method handling).
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end()
      return
    }
    /* v8 ignore next -- node:http always sets url on server requests */
    const rawPath = new URL(req.url ?? '/', 'http://x').pathname
    const acceptEncoding = req.headers['accept-encoding']
    await serveStatic(
      decodeURIComponent(rawPath),
      res,
      distRoot,
      distIndex,
      () => ctx.connection.authorizeIndex(req, res),
      renderIndex,
      acceptEncoding,
    )
  }), 'frontend-static: fallback seat')
}