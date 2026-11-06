/**
 * Behavior coverage for the structured-logging file sink: boots Loader
 * compositions with the plugin and asserts JSON-lines content, level
 * filtering, argument sanitization, size rotation with bounded archives,
 * restart appending, loud load failures, and sink removal on fiber disposal.
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import * as StructuredLogging from '../src/index.ts'

const PLUGIN = '@deepseek-ai/dsh-structured-logging'

/** Config lines activating the sink at the given file path. */
const withFile = (file: string): string[] => [`file: '${file}'`]

let roots: { ctx: Context; dir: string }[] = []

afterEach(async () => {
  const loaded = roots
  roots = []
  for (const { ctx, dir } of loaded) {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})

interface Booted {
  ctx: Context
  file: string
}

/** The args array of one parsed record, for element assertions. */
function argsOf(record: Record<string, unknown> | undefined): unknown[] {
  return (record?.args ?? []) as unknown[]
}

/**
 * Boot a Loader composition with one structured-logging row.
 * @param configure - builds the row's cordis.yml config lines from the default file path and temp dir.
 * @param reuse - an existing dir/file pair instead of a fresh temp dir.
 * @returns the root context and the default log-file path.
 */
async function boot(configure: (file: string, dir: string) => string[], reuse?: { dir: string; file: string }): Promise<Booted> {
  const dir = reuse?.dir ?? await mkdtemp(join(tmpdir(), 'dsh-structured-logging-'))
  const file = reuse?.file ?? join(dir, 'logs', 'app.log')
  const configLines = configure(file, dir)
  const configPath = join(dir, 'cordis.yml')
  await writeFile(configPath, [
    `- name: '${PLUGIN}'`,
    ...(configLines.length > 0 ? ['  config:', ...configLines.map(line => `    ${line}`)] : []),
    '',
  ].join('\n'))
  const ctx = new Context()
  roots.push({ ctx, dir })
  ctx.baseUrl = pathToFileURL(dir).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([[PLUGIN, StructuredLogging]])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  return { ctx, file }
}

/** The plugin entry's fiber, for failure and disposal assertions. */
function pluginFiber(ctx: Context) {
  return [...ctx.loader.entries()].find(entry => entry.options.name === PLUGIN)?.fiber
}

/** Parse the JSON-lines file into records. */
function readRecords(file: string): Record<string, unknown>[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

describe('structured-logging', () => {
  it('writes one JSON record per logger call', async () => {
    const { ctx, file } = await boot(withFile)
    ctx.logger.warn('hello %s', 'world', { a: 1 })
    const records = readRecords(file)
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record?.level).toBe('warn')
    expect(record?.message).toContain('hello world')
    expect(record?.args).toEqual(['hello %s', 'world', { a: 1 }])
    expect(typeof record?.time).toBe('string')
    expect(typeof record?.ts).toBe('number')
    expect(typeof record?.sn).toBe('number')
    expect(typeof record?.name).toBe('string')
  })

  it('captures error, info, and warn but not debug at the default level', async () => {
    const { ctx, file } = await boot(withFile)
    ctx.logger.error('e1')
    ctx.logger.info('i1')
    ctx.logger.warn('w1')
    ctx.logger.debug('d1')
    expect(readRecords(file).map(record => record.level)).toEqual(['error', 'info', 'warn'])
  })

  it('captures debug at level 3', async () => {
    const { ctx, file } = await boot(file => [...withFile(file), 'level: 3'])
    ctx.logger.debug('d1')
    expect(readRecords(file).map(record => record.level)).toEqual(['debug'])
  })

  it('stays inert without a file config', async () => {
    const { ctx, file } = await boot(() => [])
    expect(() => ctx.logger.warn('dropped')).not.toThrow()
    expect(existsSync(file)).toBe(false)
  })

  it('sanitizes errors, cycles, and exotic primitives', async () => {
    const { ctx, file } = await boot(withFile)
    ctx.logger.error(new Error('boom'))
    ctx.logger.error(new Error('outer', { cause: new Error('inner') }))
    const circular: Record<string, unknown> = {}
    circular.self = circular
    ctx.logger.warn('circ %o', circular)
    ctx.logger.warn('mix %o', 10n, Symbol('sym'), () => 42, undefined, null, true, 42, [1, [2]])
    const records = readRecords(file)
    const boom = argsOf(records[0])[0] as { name: string; message: string; stack?: string; cause?: unknown }
    expect(boom).toMatchObject({ name: 'Error', message: 'boom' })
    expect(boom.stack).toContain('Error: boom')
    expect(boom.cause).toBeUndefined()
    // An error with a cause logs the cause first, then the outer error.
    expect(records[1]?.message).toContain('inner')
    expect(argsOf(records[2])[0]).toMatchObject({ message: 'outer', cause: { message: 'inner' } })
    expect(records[3]?.message).toContain('[Circular]')
    expect(argsOf(records[3])[1]).toEqual({ self: '[Circular]' })
    const mix = records[4]
    expect(mix?.message).toContain('mix "10" Symbol(sym)')
    expect(argsOf(mix)[1]).toBe('10')
    expect(argsOf(mix)[2]).toBe('Symbol(sym)')
    expect(argsOf(mix)[3]).toBe('() => 42')
    expect(argsOf(mix)[4]).toBeNull()
    expect(argsOf(mix)[8]).toEqual([1, [2]])
  })

  it('rotates at the size limit and keeps at most maxFiles archives', async () => {
    const { ctx, file } = await boot(file => [...withFile(file), 'maxFileSizeBytes: 400', 'maxFiles: 2'])
    for (let index = 0; index < 8; index += 1) ctx.logger.warn('rotation probe %d', index)
    expect(readRecords(file).length).toBeGreaterThanOrEqual(1)
    for (const archive of [`${file}.1`, `${file}.2`]) {
      expect(existsSync(archive)).toBe(true)
      expect(() => readRecords(archive)).not.toThrow()
    }
    expect(existsSync(`${file}.3`)).toBe(false)
  })

  it('appends across restarts and rotates inherited content into archives', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-structured-logging-'))
    const file = join(dir, 'logs', 'app.log')
    const first = await boot(withFile, { dir, file })
    first.ctx.logger.warn('before restart')
    await first.ctx.fiber.dispose()
    const second = await boot(file => [...withFile(file), 'maxFileSizeBytes: 400'], { dir, file })
    for (let index = 0; index < 4; index += 1) second.ctx.logger.warn('after restart %d', index)
    // Line sizes vary by a few bytes, so the rotation count is not exact;
    // 'before restart' lands in whichever archive the rotations shifted it to.
    const archived = [1, 2, 3, 4].flatMap(n => existsSync(`${file}.${n}`) ? readRecords(`${file}.${n}`) : [])
    expect(existsSync(`${file}.1`)).toBe(true)
    expect(archived.some(record => String(record.message).includes('before restart'))).toBe(true)
    expect(readRecords(file).every(record => String(record.message).includes('after restart'))).toBe(true)
  })

  it('rejects an out-of-range level at load', async () => {
    const { ctx, file } = await boot(file => [...withFile(file), 'level: 4'])
    await expect(pluginFiber(ctx)?.await()).rejects.toThrow()
    expect(existsSync(file)).toBe(false)
  })

  it('fails loud when the log path is a directory', async () => {
    const { ctx, file } = await boot((_file, dir) => [`file: '${dir}'`])
    await expect(pluginFiber(ctx)?.await()).rejects.toThrow(/EISDIR/)
    expect(existsSync(file)).toBe(false)
  })

  it('stops writing when the plugin fiber disposes (HMR safety)', async () => {
    const { ctx, file } = await boot(withFile)
    ctx.logger.warn('first')
    await pluginFiber(ctx)?.dispose()
    expect(() => ctx.logger.warn('after dispose')).not.toThrow()
    const records = readRecords(file)
    expect(records).toHaveLength(1)
    expect(records[0]?.message).toContain('first')
  })
})
