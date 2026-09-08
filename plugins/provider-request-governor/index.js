import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { appendFile, mkdir, open, readFile, stat, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'

export const name = 'minimal-omni-provider-request-governor'
export const inject = ['llm']

const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
})()

const DEFAULT_LOCK_WAIT_MS = 5_000
const DEFAULT_STALE_LOCK_MS = 30_000
const DEFAULT_LOCK_RETRY_MS = 25

function cleanScalar(value, fallback = null) {
  if (value === undefined || value === null) return fallback
  const text = String(value).replace(/[\r\n]/g, '').slice(0, 240)
  return text || fallback
}

function pathKey(value) {
  const normalized = normalize(resolve(value)).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function pathInside(child, parent) {
  const childKey = pathKey(child)
  const parentKey = pathKey(parent)
  if (childKey === parentKey) return true
  const rest = relative(parentKey, childKey)
  return rest !== '' && rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest)
}

function isolationError(message) {
  const error = new Error(`DSH_HOME_ISOLATION_VIOLATION: ${message}`)
  error.code = 'DSH_HOME_ISOLATION_VIOLATION'
  return error
}

export function attestChildIsolation({ dshHome = process.env.DSH_HOME, sentinelPath = process.env.DSH_ISOLATION_SENTINEL, nonce = process.env.DSH_ISOLATION_NONCE } = {}) {
  if (!dshHome || !sentinelPath || !nonce) throw isolationError('DSH_HOME, DSH_ISOLATION_SENTINEL, and DSH_ISOLATION_NONCE are required')
  const home = pathKey(dshHome)
  const defaultHome = pathKey(resolve(process.env.USERPROFILE || process.env.HOME || '', '.dsh'))
  if (home === defaultHome) throw isolationError('default user DSH_HOME is forbidden')
  let payload
  try { payload = JSON.parse(readFileSync(sentinelPath, 'utf8')) } catch { throw isolationError('sentinel is unreadable') }
  if (payload?.schema !== 'minimal-omni-isolation/v1' || payload.nonce !== nonce || pathKey(payload.canonicalHome) !== home) {
    throw isolationError('sentinel does not match the child DSH_HOME')
  }
  let resolvedSentinel
  try { resolvedSentinel = realpathSync.native(sentinelPath) } catch { throw isolationError('sentinel path cannot be resolved') }
  if (!pathInside(resolvedSentinel, dshHome)) throw isolationError('sentinel is outside DSH_HOME')
  return { canonicalHome: home, sentinelPath: normalize(sentinelPath), nonce }
}

function budgetError(code, details) {
  const error = new Error(code)
  error.code = code
  error.details = details
  return error
}

async function delay(milliseconds) {
  await new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

async function acquireLock(lockPath, { waitMs = DEFAULT_LOCK_WAIT_MS, staleMs = DEFAULT_STALE_LOCK_MS } = {}) {
  const started = Date.now()
  await mkdir(dirname(lockPath), { recursive: true })
  while (Date.now() - started <= waitMs) {
    try {
      const handle = await open(lockPath, 'wx')
      return async () => {
        try { await handle.close() } finally { await unlink(lockPath).catch(() => {}) }
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      try {
        const info = await stat(lockPath)
        if (Date.now() - info.mtimeMs > staleMs) await unlink(lockPath)
      } catch {}
      await delay(DEFAULT_LOCK_RETRY_MS)
    }
  }
  throw new Error('LIVE_PROVIDER_BUDGET_LEDGER_LOCK_TIMEOUT')
}

async function readRecords(ledgerPath) {
  if (!existsSync(ledgerPath)) return []
  const text = await readFile(ledgerPath, 'utf8')
  const records = []
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    try {
      const value = JSON.parse(line)
      if (!value || typeof value !== 'object') throw new Error('not an object')
      records.push(value)
    } catch {
      const error = new Error(`LIVE_PROVIDER_BUDGET_LEDGER_CORRUPT at line ${index + 1}`)
      error.code = 'LIVE_PROVIDER_BUDGET_LEDGER_CORRUPT'
      throw error
    }
  }
  return records
}

function requestClassFor(options = {}, fallback = 'direct-llm') {
  const purpose = cleanScalar(options.purpose)
  if (purpose !== null) return purpose
  return cleanScalar(options.requestClass, fallback)
}

/** Re-read every request's options; never reuse a session from an earlier call. */
function metadata(options = {}, requestClass = 'direct-llm', taskId = null) {
  const sessionId = cleanScalar(options.sessionId ?? options.session?.id)
  return {
    provider: cleanScalar(options.provider ?? options.route?.provider, 'unknown'),
    model: cleanScalar(options.model ?? options.route?.model, 'unknown'),
    purpose: cleanScalar(options.purpose),
    requestClass: cleanScalar(requestClass, 'direct-llm'),
    sessionId,
    attribution: sessionId === null ? 'DIRECT_LLM_STREAM' : 'OPTIONS_SESSION_ID',
    turnId: cleanScalar(options.turnId),
    stepId: cleanScalar(options.stepId),
    taskId: cleanScalar(options.taskId ?? taskId),
  }
}

function sequenceFor(records) {
  return records.reduce((highest, record) => Math.max(highest, Number(record.sequence) || 0), 0) + 1
}

function validateTaskCap(taskCap) {
  if (taskCap === null || taskCap === undefined) return null
  if (!Number.isInteger(taskCap) || taskCap <= 0) throw new Error('LIVE_PROVIDER_TASK_REQUEST_CAP_INVALID')
  return taskCap
}

function attestationPathFor({ attestationPath, dshHome = process.env.DSH_HOME } = {}) {
  if (attestationPath) return normalize(resolve(attestationPath))
  if (!dshHome) throw new Error('LIVE_PROVIDER_PROCESS_ATTESTATION_REQUIRED')
  return join(normalize(resolve(dshHome)), 'acceptance', 'process-attestation.jsonl')
}

function processStartIdentity() {
  return new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString()
}

/** Record only non-sensitive process coverage facts for one acceptance runtime. */
export function recordProcessAttestation({
  ledgerPath,
  runId,
  attestationPath,
  role = process.env.DSH_PROCESS_ROLE ?? 'llm-owner',
  bootNonce = process.env.DSH_BOOT_NONCE,
  profile = process.env.DSH_ACCEPTANCE_PROFILE ?? process.env.DSH_PROFILE ?? null,
  pluginVersion = PACKAGE_VERSION,
} = {}) {
  if (!ledgerPath || !isAbsolute(ledgerPath)) throw new Error('LIVE_PROVIDER_BUDGET_LEDGER_REQUIRED')
  if (!runId) throw new Error('LIVE_PROVIDER_REQUEST_RUN_ID_REQUIRED')
  const dshHome = process.env.DSH_HOME
  if (!dshHome) throw new Error('LIVE_PROVIDER_PROCESS_ATTESTATION_REQUIRED')
  if (!bootNonce) throw new Error('LIVE_PROVIDER_BOOT_NONCE_REQUIRED')
  if (!profile) throw new Error('LIVE_PROVIDER_ACCEPTANCE_PROFILE_REQUIRED')
  const target = attestationPathFor({ attestationPath, dshHome })
  if (!pathInside(target, dshHome)) throw isolationError('process attestation must stay inside DSH_HOME')
  try {
    mkdirSync(dirname(target), { recursive: true })
    appendFileSync(target, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      pid: process.pid,
      processStartIdentity: processStartIdentity(),
      role: cleanScalar(role, 'llm-owner'),
      governorLoaded: true,
      active: true,
      profile: cleanScalar(profile, 'unknown'),
      pluginVersion: cleanScalar(pluginVersion, 'unknown'),
      listenerMode: 'global-prepend',
      bootNonceHash: hashSignature(cleanScalar(bootNonce, 'unknown')),
      ledgerPathHash: hashSignature(pathKey(ledgerPath)),
      runId: cleanScalar(runId, 'unknown'),
    })}\n`, 'utf8')
  } catch (error) {
    const failure = new Error(`LIVE_PROVIDER_PROCESS_ATTESTATION_FAILED: ${error instanceof Error ? error.message : String(error)}`)
    failure.code = 'LIVE_PROVIDER_PROCESS_ATTESTATION_FAILED'
    throw failure
  }
  return target
}

/** Atomically admit one provider attempt against the global and optional task cap. */
export async function reserveRequest({ ledgerPath, authorizedCap, runId, options = {}, requestClass = 'direct-llm', taskId = null, taskCap = null, lockWaitMs = DEFAULT_LOCK_WAIT_MS } = {}) {
  if (!ledgerPath || !isAbsolute(ledgerPath)) throw new Error('LIVE_PROVIDER_BUDGET_LEDGER_REQUIRED')
  if (!Number.isInteger(authorizedCap) || authorizedCap <= 0) throw new Error('LIVE_PROVIDER_REQUEST_CAP_INVALID')
  if (!runId) throw new Error('LIVE_PROVIDER_REQUEST_RUN_ID_REQUIRED')
  const resolvedTaskCap = validateTaskCap(options.taskRequestCap ?? options.taskCap ?? taskCap)
  const resolvedTaskId = cleanScalar(options.taskId ?? taskId)
  if (resolvedTaskCap !== null && resolvedTaskId === null) throw new Error('LIVE_PROVIDER_TASK_ID_REQUIRED')
  const canonicalLedger = normalize(resolve(ledgerPath))
  const home = process.env.DSH_HOME
  if (home && !pathInside(canonicalLedger, home)) throw isolationError('provider ledger must stay inside DSH_HOME')
  const lockPath = `${canonicalLedger}.lock`
  const release = await acquireLock(lockPath, { waitMs: lockWaitMs })
  try {
    const records = await readRecords(canonicalLedger)
    const usedCount = records.filter(record => record.dispatchAttempted === true).length
    const nextRequestClass = requestClassFor(options, requestClass)
    const taskUsedCount = resolvedTaskId === null
      ? 0
      : records.filter(record => record.dispatchAttempted === true && record.taskId === resolvedTaskId).length
    if (usedCount >= authorizedCap) {
      const blocked = {
        sequence: sequenceFor(records), timestamp: new Date().toISOString(), runId: cleanScalar(runId, 'unknown'),
        ...metadata(options, nextRequestClass, resolvedTaskId), dispatchAttempted: false,
        outcome: 'blocked-before-dispatch', blockCode: 'LIVE_PROVIDER_GLOBAL_BUDGET_EXHAUSTED',
        authorizedCap, usedCount, taskCap: resolvedTaskCap, taskUsedCount,
      }
      await appendFile(canonicalLedger, `${JSON.stringify(blocked)}\n`, 'utf8')
      throw budgetError('LIVE_PROVIDER_GLOBAL_BUDGET_EXHAUSTED', { authorizedCap, usedCount, nextRequestClass, runId: cleanScalar(runId, 'unknown'), taskId: resolvedTaskId, taskCap: resolvedTaskCap, taskUsedCount })
    }
    if (resolvedTaskCap !== null && taskUsedCount >= resolvedTaskCap) {
      const blocked = {
        sequence: sequenceFor(records), timestamp: new Date().toISOString(), runId: cleanScalar(runId, 'unknown'),
        ...metadata(options, nextRequestClass, resolvedTaskId), dispatchAttempted: false,
        outcome: 'blocked-before-dispatch', blockCode: 'LIVE_PROVIDER_TASK_BUDGET_EXHAUSTED',
        authorizedCap, usedCount, taskCap: resolvedTaskCap, taskUsedCount,
      }
      await appendFile(canonicalLedger, `${JSON.stringify(blocked)}\n`, 'utf8')
      throw budgetError('LIVE_PROVIDER_TASK_BUDGET_EXHAUSTED', { authorizedCap, usedCount, nextRequestClass, runId: cleanScalar(runId, 'unknown'), taskId: resolvedTaskId, taskCap: resolvedTaskCap, taskUsedCount })
    }
    const record = {
      sequence: sequenceFor(records), timestamp: new Date().toISOString(), runId: cleanScalar(runId, 'unknown'),
      ...metadata(options, nextRequestClass, resolvedTaskId), dispatchAttempted: true,
      outcome: 'reserved-before-dispatch', authorizedCap, usedCount: usedCount + 1,
      taskCap: resolvedTaskCap, taskUsedCount: resolvedTaskId === null ? 0 : taskUsedCount + 1,
    }
    await appendFile(canonicalLedger, `${JSON.stringify(record)}\n`, 'utf8')
    return { admitted: true, authorizedCap, usedCount: usedCount + 1, taskId: resolvedTaskId, taskCap: resolvedTaskCap, taskUsedCount: record.taskUsedCount, sequence: record.sequence }
  } finally {
    await release()
  }
}

export function buildBudgetConfig(env = process.env) {
  const required = env.DSH_PROVIDER_REQUEST_GOVERNOR === 'required'
  if (!required) return { required: false }
  const cap = Number(env.DSH_PROVIDER_REQUEST_CAP)
  if (!Number.isInteger(cap) || cap <= 0) throw new Error('LIVE_PROVIDER_REQUEST_CAP_INVALID')
  if (!env.DSH_PROVIDER_REQUEST_LEDGER) throw new Error('LIVE_PROVIDER_BUDGET_LEDGER_REQUIRED')
  if (!env.DSH_PROVIDER_REQUEST_RUN_ID) throw new Error('LIVE_PROVIDER_REQUEST_RUN_ID_REQUIRED')
  const taskCap = env.DSH_PROVIDER_TASK_CAP === undefined || env.DSH_PROVIDER_TASK_CAP === ''
    ? null : validateTaskCap(Number(env.DSH_PROVIDER_TASK_CAP))
  const taskId = cleanScalar(env.DSH_PROVIDER_TASK_ID)
  if (taskCap !== null && taskId === null) throw new Error('LIVE_PROVIDER_TASK_ID_REQUIRED')
  const attestationPath = env.DSH_PROVIDER_REQUEST_ATTESTATION
    ?? (env.DSH_HOME ? join(env.DSH_HOME, 'acceptance', 'process-attestation.jsonl') : null)
  if (!attestationPath) throw new Error('LIVE_PROVIDER_PROCESS_ATTESTATION_REQUIRED')
  if (!env.DSH_BOOT_NONCE) throw new Error('LIVE_PROVIDER_BOOT_NONCE_REQUIRED')
  const profile = cleanScalar(env.DSH_ACCEPTANCE_PROFILE ?? env.DSH_PROFILE)
  if (!profile) throw new Error('LIVE_PROVIDER_ACCEPTANCE_PROFILE_REQUIRED')
  return { required: true, cap, ledgerPath: env.DSH_PROVIDER_REQUEST_LEDGER, runId: env.DSH_PROVIDER_REQUEST_RUN_ID, taskCap, taskId, attestationPath, bootNonce: env.DSH_BOOT_NONCE, profile }
}

export async function* governedStream(options, next, config) {
  const requestClass = requestClassFor(options, config.requestClass ?? 'direct-llm')
  await reserveRequest({ ledgerPath: config.ledgerPath, authorizedCap: config.cap, runId: config.runId, options, requestClass, taskId: config.taskId, taskCap: config.taskCap })
  yield* next()
}

export function apply(ctx, pluginConfig = {}) {
  if (pluginConfig.requireIsolation !== false || process.env.DSH_ISOLATION_GUARD_REQUIRED === '1') attestChildIsolation()
  const budget = buildBudgetConfig()
  if (!budget.required) return
  // Official DSH uses this same root-level invariant shape. The global,
  // prepended listener covers agent, Goal, compaction, title, retry, and
  // direct streams without adding prompt text or tools.
  ctx.on('llm/stream', (options, next) => governedStream(options, next, budget), { global: true, prepend: true })
  recordProcessAttestation(budget)
}

export function hashSignature(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

// No prompt/tool registration: the governor is model-invisible infrastructure.
