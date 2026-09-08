import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, normalize, parse, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ISOLATION_SENTINEL_NAME = '.minimal-omni-isolation-sentinel.json'

function displayPath(value) {
  return String(value ?? '').replace(/[\r\n]/g, '')
}

function comparePath(value) {
  const normalized = normalize(resolve(value)).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function nearestExisting(value) {
  let current = resolve(value)
  const suffix = []
  while (!existsSync(current)) {
    const parsed = parse(current)
    if (current === parsed.root) break
    suffix.unshift(parsed.base)
    current = dirname(current)
  }
  const base = existsSync(current) ? realpathSync.native(current) : current
  return suffix.reduce((parent, part) => join(parent, part), base)
}

export function canonicalPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('DSH_HOME_ISOLATION_VIOLATION: path is required')
  const candidate = value.trim()
  if (!isAbsolute(candidate)) throw new Error('DSH_HOME_ISOLATION_VIOLATION: path must be absolute')
  return normalize(nearestExisting(candidate))
}

function isWithin(child, parent) {
  const childKey = comparePath(child)
  const parentKey = comparePath(parent)
  if (childKey === parentKey) return true
  const rel = relative(parentKey, childKey)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export function assertIsolation({ dshHome, projectRoot, allowedRoots, defaultHome = join(homedir(), '.dsh') }) {
  if (typeof dshHome !== 'string' || !dshHome.trim()) throw new Error('DSH_HOME_ISOLATION_VIOLATION: DSH_HOME is required')
  const canonicalHome = canonicalPath(dshHome)
  const canonicalDefaultHome = canonicalPath(defaultHome)
  if (comparePath(canonicalHome) === comparePath(canonicalDefaultHome)) {
    throw new Error('DSH_HOME_ISOLATION_VIOLATION: default user DSH_HOME is forbidden')
  }
  const roots = (Array.isArray(allowedRoots) ? allowedRoots : []).filter(Boolean).map(canonicalPath)
  if (!roots.length || !roots.some(root => isWithin(canonicalHome, root))) {
    throw new Error('DSH_HOME_ISOLATION_VIOLATION: DSH_HOME is outside the allowed isolation roots')
  }
  if (projectRoot && comparePath(canonicalHome) === comparePath(canonicalPath(projectRoot))) {
    throw new Error('DSH_HOME_ISOLATION_VIOLATION: DSH_HOME cannot be the project root')
  }
  return { canonicalHome, canonicalDefaultHome, canonicalAllowedRoots: roots }
}

export function writeIsolationSentinel({ dshHome, canonicalHome = canonicalPath(dshHome), nonce = randomUUID() }) {
  mkdirSync(canonicalHome, { recursive: true })
  const sentinelPath = join(canonicalHome, ISOLATION_SENTINEL_NAME)
  const payload = {
    schema: 'minimal-omni-isolation/v1',
    nonce,
    canonicalHome,
    createdAt: new Date().toISOString(),
  }
  writeFileSync(sentinelPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 })
  return { sentinelPath, nonce, canonicalHome }
}

export function attestIsolationSentinel({ dshHome, sentinelPath = join(dshHome, ISOLATION_SENTINEL_NAME), nonce }) {
  if (!nonce || typeof nonce !== 'string') throw new Error('DSH_HOME_ISOLATION_VIOLATION: isolation nonce is required')
  const canonicalHome = canonicalPath(dshHome)
  let payload
  try { payload = JSON.parse(readFileSync(sentinelPath, 'utf8')) } catch { throw new Error('DSH_HOME_ISOLATION_VIOLATION: isolation sentinel is unreadable') }
  if (payload?.schema !== 'minimal-omni-isolation/v1' || payload.nonce !== nonce || comparePath(payload.canonicalHome) !== comparePath(canonicalHome)) {
    throw new Error('DSH_HOME_ISOLATION_VIOLATION: isolation sentinel does not attest the child DSH_HOME')
  }
  return { canonicalHome, sentinelPath, nonce }
}

function parseArguments(argv) {
  const result = { allowedRoots: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--allowed-root') result.allowedRoots.push(argv[++index])
    else if (arg === '--dsh-home') result.dshHome = argv[++index]
    else if (arg === '--project-root') result.projectRoot = argv[++index]
    else if (arg === '--default-home') result.defaultHome = argv[++index]
    else if (arg === '--sentinel') result.sentinelPath = argv[++index]
    else if (arg === '--nonce') result.nonce = argv[++index]
    else if (arg === '--write-sentinel') result.writeSentinel = true
    else if (arg === '--attest') result.attest = true
    else throw new Error(`unknown isolation-guard argument: ${arg}`)
  }
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArguments(process.argv.slice(2))
    const checked = assertIsolation(args)
    const result = args.writeSentinel
      ? { ...checked, ...writeIsolationSentinel({ dshHome: args.dshHome, canonicalHome: checked.canonicalHome, nonce: args.nonce }) }
      : args.attest
        ? { ...checked, ...attestIsolationSentinel({ dshHome: args.dshHome, sentinelPath: args.sentinelPath, nonce: args.nonce }) }
        : checked
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n`)
    process.exitCode = 1
  }
}
