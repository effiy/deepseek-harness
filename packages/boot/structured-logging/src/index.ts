/**
 * Structured JSON-lines process logging for aggregation systems.
 *
 * When {@link Config.file} names a path, the plugin attaches a Cordis logger
 * exporter that appends one JSON object per log record to that file and
 * rotates it by size into a bounded number of archives. Without a file path
 * the plugin registers nothing. Console output is unchanged, and direct
 * `console.*` calls never pass through the Cordis logger, so they never
 * reach this sink.
 *
 * @module @deepseek-ai/dsh-structured-logging
 */

import { closeSync, existsSync, mkdirSync, openSync, renameSync, statSync, writeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Logger, type Context, type Exporter, type Message } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Stable Cordis plugin name. */
export const name = 'structured-logging'

/** Deployment configuration of the JSON-lines file sink. */
export interface Config {
  /** Log-file path, resolved against the process working directory; omit to keep the plugin inert. */
  file?: string
  /** Byte size at which the active file rotates into a numbered archive. */
  maxFileSizeBytes?: number
  /** Number of numbered archives kept beside the active file. */
  maxFiles?: number
  /** Least severe captured Cordis logger level: 0 error, 1 info, 2 warn, 3 debug. */
  level?: number
}

/** Schemastery validator for {@link Config}; cordis runs it before the plugin starts. */
export const Config: z<Config> = z.object({
  file: z.string(),
  maxFileSizeBytes: z.number().step(1).min(1),
  maxFiles: z.number().step(1).min(1),
  level: z.number().step(1).min(0).max(3),
})

/** Default rotation size of the active file: 10 MiB. */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 10_485_760

/** Default number of retained numbered archives. */
export const DEFAULT_MAX_FILES = 5

/** Default capture threshold: error, info, and warn records; debug stays out. */
export const DEFAULT_LEVEL = 2

/**
 * Convert one log argument into a JSON-safe value that `JSON.stringify` and
 * `Logger.format` both accept. Cycles become `'[Circular]'`; bigint, symbol,
 * and function values become their string form; errors keep `name`, `message`,
 * `stack`, and a likewise converted `cause`.
 * @param value - the argument to convert.
 * @param seen - objects already on this argument's conversion path.
 * @returns the converted value.
 */
function safeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') return String(value)
  if (typeof value !== 'object' || value === null) return value
  if (value instanceof Error) {
    const safe = { name: value.name, message: value.message, stack: value.stack }
    return value.cause === undefined ? safe : { ...safe, cause: safeValue(value.cause, seen) }
  }
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map(item => safeValue(item, seen))
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeValue(item, seen)]))
}

/**
 * Build the file record for one sanitized logger message.
 * @param exporter - the exporter whose settings render the `message` text.
 * @param message - a logger record whose args already passed {@link safeValue}.
 * @returns the JSON-safe object serialized as one log-file line.
 */
function record(exporter: Exporter, message: Message): Record<string, unknown> {
  return {
    time: new Date(message.ts).toISOString(),
    ts: message.ts,
    sn: message.sn,
    level: message.type,
    name: message.name,
    message: Logger.format(exporter, message),
    args: message.args,
  }
}

/**
 * Attach the JSON-lines file sink for every Cordis logger record at or above
 * {@link Config.level}; inert when `config.file` is omitted. Exporter and file
 * handle hang on the plugin fiber: disposal removes the exporter first, then
 * closes the handle. Unusable paths fail the plugin fiber at load.
 * @param ctx - the composition context providing the logger service.
 * @param config - the validated deployment configuration.
 */
export function apply(ctx: Context, config: Config): void {
  if (config.file === undefined) return
  const file = resolve(config.file)
  const maxFileSizeBytes = config.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES
  const maxFiles = config.maxFiles ?? DEFAULT_MAX_FILES
  const level = config.level ?? DEFAULT_LEVEL
  let fd = -1
  let size = 0
  ctx.effect(() => {
    mkdirSync(dirname(file), { recursive: true })
    fd = openSync(file, 'a')
    size = statSync(file).size
    return () => { closeSync(fd) }
  }, 'structured-logging: log file handle')
  const rotate = (): void => {
    closeSync(fd)
    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const archive = `${file}.${index}`
      if (existsSync(archive)) renameSync(archive, `${file}.${index + 1}`)
    }
    renameSync(file, `${file}.1`)
    fd = openSync(file, 'a')
    size = 0
  }
  const exporter: Exporter = {
    colors: false,
    levels: { default: level },
    export(message) {
      const args = message.args.map(arg => safeValue(arg, new WeakSet()))
      const line = `${JSON.stringify(record(exporter, { ...message, args }))}\n`
      const bytes = Buffer.byteLength(line)
      if (size + bytes > maxFileSizeBytes) rotate()
      writeSync(fd, line)
      size += bytes
    },
  }
  ctx.logger.exporter(exporter)
}
