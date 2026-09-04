import { spawn } from 'node:child_process'

const REPOSITORY = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024

/** A stable, intentionally small operation catalog. There is no raw `gh` escape hatch. */
export const OPERATION_CATALOG = Object.freeze({
  'repo.view': { write: false, fields: 'nameWithOwner,defaultBranchRef,visibility,licenseInfo,description' },
  'repo.list': { write: false, fields: 'nameWithOwner,visibility,isPrivate,isArchived' },
  'issue.list': { write: false, fields: 'number,title,state,url' },
  'issue.view': { write: false, fields: 'number,title,state,url,author,labels,createdAt,updatedAt' },
  'issue.create': { write: true, fields: 'number,title,url' },
  'pr.list': { write: false, fields: 'number,title,state,isDraft,url' },
  'pr.view': { write: false, fields: 'number,title,state,isDraft,url,author,createdAt,updatedAt' },
  'workflow.list': { write: false, fields: 'id,name,state,path' },
  // `gh release list --json` does not expose a URL field in the current CLI;
  // callers can derive the canonical URL from nameWithOwner + tagName.
  'release.list': { write: false, fields: 'name,tagName,isDraft,isPrerelease,publishedAt' },
})

export class GitHubCapabilityError extends Error {
  constructor(code, message, options = {}) {
    super(message, options)
    this.name = 'GitHubCapabilityError'
    this.code = code
  }
}

export function validateRepository(value) {
  if (typeof value !== 'string' || !REPOSITORY.test(value)) {
    throw new GitHubCapabilityError('INVALID_REPOSITORY', 'repository must be an owner/name pair')
  }
  return value
}

function validateLimit(value) {
  const limit = value === undefined ? 20 : Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new GitHubCapabilityError('INVALID_LIMIT', 'limit must be an integer between 1 and 100')
  }
  return limit
}

function validateNumber(value, label) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    throw new GitHubCapabilityError(`INVALID_${label.toUpperCase()}_NUMBER`, `${label} number must be a positive integer`)
  }
  return number
}

function validateText(value, label, maxBytes) {
  if (typeof value !== 'string' || value.trim() === '' || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new GitHubCapabilityError(`INVALID_${label.toUpperCase()}`, `${label} must be non-empty and at most ${maxBytes} UTF-8 bytes`)
  }
  return value
}

/** Remove credential-looking material before an error can reach a caller or log. */
export function redactSecrets(value) {
  return String(value)
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1<redacted>@')
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+\b/g, '<redacted-github-token>')
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/g, '<redacted-github-token>')
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1<redacted>')
    .replace(/((?:password|passwd|secret|token|api[_-]?key)\s*[=:]\s*["']?)[^\s,"']+/gi, '$1<redacted>')
}

function jsonFields(fields) {
  return ['--json', fields]
}

/** Build one fixed GitHub CLI invocation from a validated capability operation. */
export function buildArguments(operation, params = {}, options = {}) {
  const spec = OPERATION_CATALOG[operation]
  if (!spec) throw new GitHubCapabilityError('UNKNOWN_OPERATION', `operation is not allow-listed: ${operation}`)
  if (spec.write && options.allowWrite !== true) {
    throw new GitHubCapabilityError('WRITE_DISABLED', `${operation} requires explicit allowWrite=true`)
  }

  if (operation === 'repo.view') {
    return ['repo', 'view', validateRepository(params.repo), ...jsonFields(spec.fields)]
  }
  if (operation === 'repo.list') {
    return ['repo', 'list', '--limit', String(validateLimit(params.limit)), ...jsonFields(spec.fields)]
  }
  if (operation === 'issue.list') {
    return ['issue', 'list', '--repo', validateRepository(params.repo), '--limit', String(validateLimit(params.limit)), ...jsonFields(spec.fields)]
  }
  if (operation === 'issue.view') {
    return ['issue', 'view', String(validateNumber(params.number, 'issue')), '--repo', validateRepository(params.repo), ...jsonFields(spec.fields)]
  }
  if (operation === 'issue.create') {
    const body = params.body === undefined ? '' : validateText(params.body, 'body', 20_000)
    return ['api', `repos/${validateRepository(params.repo)}/issues`, '--method', 'POST',
      '--field', `title=${validateText(params.title, 'title', 200)}`,
      '--field', `body=${body}`,
      '--jq', '{number,title,url}']
  }
  if (operation === 'pr.list') {
    return ['pr', 'list', '--repo', validateRepository(params.repo), '--limit', String(validateLimit(params.limit)), ...jsonFields(spec.fields)]
  }
  if (operation === 'pr.view') {
    return ['pr', 'view', String(validateNumber(params.number, 'pr')), '--repo', validateRepository(params.repo), ...jsonFields(spec.fields)]
  }
  if (operation === 'workflow.list') {
    return ['workflow', 'list', '--repo', validateRepository(params.repo), '--limit', String(validateLimit(params.limit)), ...jsonFields(spec.fields)]
  }
  if (operation === 'release.list') {
    return ['release', 'list', '--repo', validateRepository(params.repo), '--limit', String(validateLimit(params.limit)), ...jsonFields(spec.fields)]
  }
  throw new GitHubCapabilityError('UNREACHABLE_OPERATION', `operation was not implemented: ${operation}`)
}

function runProcess(command, args, options = {}) {
  const runner = options.runner
  if (runner) return Promise.resolve(runner(args, command))
  return new Promise((resolve, reject) => {
    const env = { ...(options.env ?? process.env), GH_HOST: 'github.com' }
    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      shell: false,
      windowsHide: true,
    })
    const stdout = []
    const stderr = []
    let stdoutBytes = 0
    let stderrBytes = 0
    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length
      if (stdoutBytes <= MAX_CAPTURE_BYTES) stdout.push(chunk)
    })
    child.stderr.on('data', chunk => {
      stderrBytes += chunk.length
      if (stderrBytes <= MAX_CAPTURE_BYTES) stderr.push(chunk)
    })
    child.once('error', error => reject(new GitHubCapabilityError('GH_NOT_EXECUTABLE', redactSecrets(error.message), { cause: error })))
    child.once('close', exitCode => resolve({
      exitCode: exitCode ?? 1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
      stdoutTruncated: stdoutBytes > MAX_CAPTURE_BYTES,
      stderrTruncated: stderrBytes > MAX_CAPTURE_BYTES,
    }))
  })
}

function parseJson(stdout, operation) {
  // `gh workflow list` reports an empty repository as a human string even
  // when it exits successfully. Normalize that stable read-only case so the
  // capability contract remains machine-readable.
  if (operation === 'workflow.list' && ['', 'no workflows found'].includes(stdout.trim().toLowerCase())) return []
  try {
    return JSON.parse(stdout)
  } catch (error) {
    throw new GitHubCapabilityError('GH_INVALID_JSON', `${operation} returned non-JSON output`, { cause: error })
  }
}

/** Execute one allow-listed operation. The injected runner makes the policy testable without network. */
export async function runOperation(operation, params = {}, options = {}) {
  const args = buildArguments(operation, params, options)
  const result = await runProcess('gh', args, options)
  if (!result || result.exitCode !== 0) {
    const detail = result?.stderr ? redactSecrets(result.stderr).trim().slice(0, 800) : 'gh returned a non-zero exit code'
    throw new GitHubCapabilityError('GH_COMMAND_FAILED', `${operation} failed: ${detail}`)
  }
  return {
    operation,
    args,
    data: parseJson(result.stdout, operation),
    diagnostics: {
      stdoutTruncated: result.stdoutTruncated === true,
      stderrTruncated: result.stderrTruncated === true,
    },
  }
}
