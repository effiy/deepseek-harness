/**
 * Dependency vulnerability audit gate for CI.
 *
 * Runs `pnpm audit` against the official npm registry, compares the result
 * against a committed baseline, and fails only on *new* high or critical
 * advisories. Existing known vulnerabilities do not block the gate — they are
 * fixed in independent PRs.
 *
 * Baseline: `.audit-baseline.json` at the repo root.  The file is committed;
 * updating it records the current advisory set as the new floor.
 *
 * Env vars:
 *   AUDIT_UPDATE_BASELINE=1   overwrite the baseline with the current audit result
 *
 * Exit codes:
 *   0 — no new high‑or‑critical advisories (or baseline was just initialized)
 *   1 — blocking: at least one NEW high or critical advisory
 *   2 — tool error (audit failed, baseline unreadable, etc.)
 *
 * @module scripts/check-ci-audit
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One advisory as stored in the baseline. */
interface BaselineAdvisory {
  module: string
  severity: string
  title: string
  cves: string[]
  /** Auditor-written sign-off record; never produced by this gate, preserved across baseline updates. */
  accepted_risk?: Record<string, unknown>
}

/** The committed baseline shape. */
interface AuditBaseline {
  generated_at: string
  summary: { critical: number; high: number; moderate: number; low: number }
  advisories: Record<string, BaselineAdvisory>
}

/** One advisory from the live pnpm audit JSON output. */
interface LiveAdvisory {
  module_name: string
  severity: string
  title: string
  cves: string[]
}

interface LiveAudit {
  error?: { code: string; message: string }
  metadata: {
    vulnerabilities: { info: number; low: number; moderate: number; high: number; critical: number }
  }
  advisories: Record<string, LiveAdvisory>
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dirname, '..')
const BASELINE_PATH = resolve(REPO_ROOT, '.audit-baseline.json')
const AUDIT_REGISTRY = 'https://registry.npmjs.org/'
const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run pnpm audit and return the parsed JSON result. */
function runAudit(): LiveAudit {
  const result = spawnSync(
    'pnpm',
    ['audit', '--registry', AUDIT_REGISTRY, '--json'],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  // pnpm audit exits non-zero when vulnerabilities exist, but JSON is on stdout.
  const stdout = result.stdout.trim()
  if (!stdout && result.error) throw result.error
  if (!stdout) throw new Error(`pnpm audit produced no output (exit ${result.status})\n${result.stderr}`)
  try {
    return JSON.parse(stdout) as LiveAudit
  } catch {
    throw new Error(`pnpm audit returned non-JSON output (exit ${result.status}):\n${stdout.slice(0, 500)}`)
  }
}

/** Read the committed baseline; returns undefined when it does not exist yet. */
function readBaseline(): AuditBaseline | undefined {
  if (!existsSync(BASELINE_PATH)) return undefined
  const raw = readFileSync(BASELINE_PATH, 'utf8')
  try {
    return JSON.parse(raw) as AuditBaseline
  } catch {
    throw new Error('.audit-baseline.json exists but is not valid JSON')
  }
}

/** Extract a stable subset from a live advisory for baseline storage. */
function toBaselineEntry(adv: LiveAdvisory): BaselineAdvisory {
  return {
    module: adv.module_name,
    severity: adv.severity,
    title: adv.title.slice(0, 160),
    cves: adv.cves ?? [],
  }
}

/** Summarise the live audit into a baseline structure. */
function buildBaseline(live: LiveAudit): AuditBaseline {
  const advisories: Record<string, BaselineAdvisory> = {}
  let critical = 0; let high = 0; let moderate = 0; let low = 0
  for (const [id, adv] of Object.entries(live.advisories)) {
    advisories[id] = toBaselineEntry(adv)
    switch (adv.severity) {
      case 'critical': critical++; break
      case 'high': high++; break
      case 'moderate': moderate++; break
      case 'low': low++; break
    }
  }
  return {
    generated_at: new Date().toISOString().slice(0, 10),
    summary: { critical, high, moderate, low },
    advisories,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const updateBaseline = process.env.AUDIT_UPDATE_BASELINE === '1'

  // 1. Run audit
  let live: LiveAudit
  try {
    live = runAudit()
  } catch (err) {
    console.error('check-ci-audit: pnpm audit failed')
    console.error(err)
    process.exit(2)
  }

  if (live.error) {
    console.error(`check-ci-audit: audit endpoint error — ${live.error.code}: ${live.error.message}`)
    process.exit(2)
  }

  // 2. Baseline update mode
  if (updateBaseline) {
    const previous = readBaseline()
    const baseline = buildBaseline(live)
    // Audit sign-off records are auditor-written annotations, not gate output:
    // carry them onto the matching advisory so an update never silently drops
    // an accepted-risk decision. An annotation whose advisory disappeared from
    // the live audit is dropped with it — the risk it accepted no longer exists.
    let carried = 0
    for (const [id, adv] of Object.entries(baseline.advisories)) {
      const prior = previous?.advisories[id]
      if (prior?.accepted_risk !== undefined) {
        adv.accepted_risk = prior.accepted_risk
        carried++
      }
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
    console.log(
      `check-ci-audit: baseline written — ${Object.keys(baseline.advisories).length} advisories`
      + ` (${baseline.summary.high} high, ${baseline.summary.critical} critical)`
      + (carried > 0 ? `, ${carried} accepted-risk annotation(s) carried over` : ''),
    )
    return
  }

  // 3. Baseline init mode (first run, no file yet)
  const existing = readBaseline()
  if (!existing) {
    const baseline = buildBaseline(live)
    console.log(`check-ci-audit: no baseline found — ${Object.keys(baseline.advisories).length} advisories exist (${baseline.summary.high} high, ${baseline.summary.critical} critical)`)
    console.log('check-ci-audit: run with AUDIT_UPDATE_BASELINE=1 to commit the current state as baseline')
    // First run always passes — we cannot block on every historic advisory.
    return
  }

  // 4. Diff mode — report new high/critical advisories
  const knownIds = new Set(Object.keys(existing.advisories))
  const newBlocking: { id: string; adv: LiveAdvisory }[] = []

  for (const [id, adv] of Object.entries(live.advisories)) {
    if (knownIds.has(id)) continue
    const weight = SEVERITY_WEIGHT[adv.severity] ?? 0
    if (weight >= (SEVERITY_WEIGHT['high'] ?? 0)) {
      newBlocking.push({ id, adv })
    }
  }

  // Also report resolved advisories for visibility
  const liveIds = new Set(Object.keys(live.advisories))
  const resolved = Object.keys(existing.advisories).filter(id => !liveIds.has(id))

  const totalLive = Object.keys(live.advisories).length
  console.log(
    `check-ci-audit: ${totalLive} advisories total (${live.metadata.vulnerabilities.high} high, ${live.metadata.vulnerabilities.critical} critical)`
    + ` — baseline has ${Object.keys(existing.advisories).length}`,
  )

  if (resolved.length > 0) {
    console.log(`check-ci-audit: ${resolved.length} previously-known advisorie(s) resolved — run AUDIT_UPDATE_BASELINE=1 to shrink the baseline`)
  }

  if (newBlocking.length === 0) {
    console.log('check-ci-audit: no new high or critical advisories — pass')
    return
  }

  // Fail
  console.error(`\ncheck-ci-audit: ${newBlocking.length} NEW high/critical advisorie(s) BLOCK this PR:\n`)
  for (const { id, adv } of newBlocking) {
    console.error(`  [${adv.severity.toUpperCase()}] ${adv.module_name}: ${adv.title}`)
    if (adv.cves && adv.cves.length > 0) console.error(`    CVEs: ${adv.cves.join(', ')}`)
    console.error(`    Advisory: https://github.com/advisories/${id}`)
    console.error()
  }
  console.error('check-ci-audit: resolve these before merging, or update the baseline if they are accepted risks.\n')
  process.exit(1)
}

main()
