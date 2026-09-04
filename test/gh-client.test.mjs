import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GitHubCapabilityError,
  buildArguments,
  redactSecrets,
  runOperation,
} from '../src/gh-client.mjs'

test('read operation builds a fixed, non-shell gh invocation', async () => {
  const calls = []
  const result = await runOperation('repo.view', { repo: 'octo/example' }, {
    runner: async (args, command) => {
      calls.push({ args, command })
      return { exitCode: 0, stdout: '{"nameWithOwner":"octo/example"}', stderr: '' }
    },
  })
  assert.deepEqual(result.data, { nameWithOwner: 'octo/example' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, 'gh')
  assert.deepEqual(calls[0].args, [
    'repo', 'view', 'octo/example', '--json',
    'nameWithOwner,defaultBranchRef,visibility,licenseInfo,description',
  ])
})

test('arbitrary operations and malformed repositories are rejected', () => {
  assert.throws(() => buildArguments('raw', { args: ['status'] }), error => error.code === 'UNKNOWN_OPERATION')
  assert.throws(() => buildArguments('repo.view', { repo: 'https://evil.example/x' }), error => error.code === 'INVALID_REPOSITORY')
  assert.throws(() => buildArguments('repo.list', { limit: 101 }), error => error.code === 'INVALID_LIMIT')
})

test('write operations require an explicit opt-in', () => {
  assert.throws(() => buildArguments('issue.create', { repo: 'octo/example', title: 'x' }), error => error.code === 'WRITE_DISABLED')
  const args = buildArguments('issue.create', { repo: 'octo/example', title: 'fixture', body: 'safe fixture' }, { allowWrite: true })
  assert.deepEqual(args.slice(0, 5), ['api', 'repos/octo/example/issues', '--method', 'POST', '--field'])
  assert.ok(args.includes('title=fixture'))
})

test('credential-looking output is redacted before diagnostics are exposed', () => {
  const token = ['ghp_', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('')
  const text = `https://user:secret@example.test ${token} Authorization: Bearer abcdef`
  const redacted = redactSecrets(text)
  assert.equal(redacted.includes('secret'), false)
  assert.equal(redacted.includes(token), false)
  assert.equal(redacted.includes('Bearer abcdef'), false)
})

test('failed gh output is bounded and redacted', async () => {
  await assert.rejects(
    () => runOperation('repo.view', { repo: 'octo/example' }, {
      runner: async () => ({ exitCode: 1, stdout: '', stderr: `Authorization: Bearer ${['ghp_', 'secret-value-1234567890'].join('')}` }),
    }),
    error => error instanceof GitHubCapabilityError
      && error.code === 'GH_COMMAND_FAILED'
      && !error.message.includes('secret-value-1234567890'),
  )
})

test('empty workflow repositories normalize to an empty list', async () => {
  const result = await runOperation('workflow.list', { repo: 'octo/example' }, {
    runner: async () => ({ exitCode: 0, stdout: 'no workflows found\n', stderr: '' }),
  })
  assert.deepEqual(result.data, [])
})
