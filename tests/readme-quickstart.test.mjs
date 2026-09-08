import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
const readmeCn = readFileSync(resolve(root, 'README.zh-CN.md'), 'utf8')

test('README has one pinned install and one uninstall command', () => {
  const install = 'dsh plugin --profile web add github:Rainflowers686/deepseek-harness-minimal-omni#v0.2.0-preview.2'
  const uninstall = 'dsh plugin --profile web remove @rain/minimal-omni'
  assert.equal(readme.split(install).length - 1, 1)
  assert.equal(readme.split(uninstall).length - 1, 1)
  assert.match(readme, /dsh --profile web/u)
  assert.match(readme, /Agent preset.*Minimal Omni/u)
  assert.match(readme, /Experimental/u)
  assert.match(readme, /Conditional/u)
  assert.match(readme, /Deferred/u)
})

test('README links the two language entry points', () => {
  assert.match(readme, /README\.zh-CN\.md/u)
  assert.match(readmeCn, /README\.md/u)
  assert.match(readmeCn, /v0\.2\.0-preview\.2/u)
})
