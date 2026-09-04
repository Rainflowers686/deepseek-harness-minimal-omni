#!/usr/bin/env node
import { runOperation, GitHubCapabilityError } from './gh-client.mjs'

function usage() {
  return [
    'dsh-github <repo|issue|pr|workflow|release> <view|list|create> [owner/name] [number] [options]',
    '',
    'Read-only by default. Supported commands:',
    '  repo view owner/name',
    '  repo list [--limit N]',
    '  issue list owner/name [--limit N]',
    '  issue view owner/name NUMBER',
    '  pr list owner/name [--limit N]',
    '  pr view owner/name NUMBER',
    '  workflow list owner/name [--limit N]',
    '  release list owner/name [--limit N]',
    '  issue create owner/name --title TITLE [--body BODY] --allow-write',
  ].join('\n')
}

function parseOptions(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (!item.startsWith('--')) throw new GitHubCapabilityError('INVALID_ARGUMENT', `unexpected argument: ${item}`)
    const key = item.slice(2)
    if (key === 'allow-write') {
      options.allowWrite = true
      continue
    }
    const value = argv[++i]
    if (value === undefined || value.startsWith('--')) throw new GitHubCapabilityError('INVALID_ARGUMENT', `missing value for --${key}`)
    options[key] = value
  }
  return options
}

async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const [kind, action, ...rest] = argv
  if (kind === 'repo' && action === 'list') {
    const options = parseOptions(rest)
    const result = await runOperation('repo.list', { limit: options.limit }, options)
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`)
    return
  }
  const repo = rest.shift()
  const number = action === 'view' ? rest.shift() : undefined
  const options = parseOptions(rest)
  let operation
  if (kind === 'repo' && action === 'view') operation = 'repo.view'
  else if (kind === 'issue' && action === 'list') operation = 'issue.list'
  else if (kind === 'issue' && action === 'view') operation = 'issue.view'
  else if (kind === 'issue' && action === 'create') operation = 'issue.create'
  else if (kind === 'pr' && action === 'list') operation = 'pr.list'
  else if (kind === 'pr' && action === 'view') operation = 'pr.view'
  else if (kind === 'workflow' && action === 'list') operation = 'workflow.list'
  else if (kind === 'release' && action === 'list') operation = 'release.list'
  else throw new GitHubCapabilityError('INVALID_COMMAND', 'command is not allow-listed')
  const params = { repo, limit: options.limit, number }
  if (operation === 'issue.create') {
    params.title = options.title
    params.body = options.body ?? ''
  }
  const result = await runOperation(operation, params, options)
  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`)
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  const code = error instanceof GitHubCapabilityError ? error.code : 'UNEXPECTED_ERROR'
  process.stderr.write(`${code}: ${error.message}\n`)
  process.exitCode = 1
}
