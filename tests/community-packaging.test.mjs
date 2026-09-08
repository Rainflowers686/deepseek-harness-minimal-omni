import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const patch = readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')
const preset = readFileSync(resolve(root, 'presets/minimal-omni/agent.cordis.yml'), 'utf8')

test('root package is one public DSH bundle', () => {
  assert.equal(manifest.private, undefined)
  assert.equal(manifest.name, '@rain/minimal-omni')
  assert.equal(manifest.version, '0.2.0-preview.2')
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.ok(Array.isArray(manifest.files))
  assert.equal(manifest.scripts?.prepare, undefined)
  assert.equal(manifest.scripts?.postinstall, undefined)
  assert.equal(manifest.scripts?.install, undefined)
  assert.equal(manifest.exports['./cordis.patch.yml'], './cordis.patch.yml')
})

test('bundle mounts the host governor and package preset without changing defaults', () => {
  assert.match(patch, /minimal-omni-provider-request-governor/u)
  assert.match(patch, /requireIsolation: false/u)
  assert.match(patch, /id: agent-presets/u)
  assert.match(patch, /default: standard/u)
  assert.match(patch, /node_modules\/@rain\/minimal-omni\/presets\//u)
  assert.doesNotMatch(patch, /thresholdRatio\s*:\s*0\.68/u)
})

test('preset keeps the idle surface small and resolves the bundled broker', () => {
  assert.match(preset, /name: '\.\.\/\.\.\/plugins\/capability-broker\/index\.js'/u)
  assert.match(preset, /request_capability|capability-broker/u)
  assert.doesNotMatch(preset, /Intent Lens|Plan Critic|Council|automatic planner/i)
})

test('normal mode does not require acceptance variables', () => {
  const governor = readFileSync(resolve(root, 'plugins/provider-request-governor/index.js'), 'utf8')
  assert.match(governor, /if \(!required\) return \{ required: false \}/u)
  assert.match(governor, /requireIsolation !== false/u)
})
