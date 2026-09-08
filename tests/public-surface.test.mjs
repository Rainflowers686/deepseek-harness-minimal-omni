import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
test('public staging contains only the model-invisible broker boundary', () => {
  const source = readFileSync(resolve(root, 'plugins/capability-broker/index.js'), 'utf8')
  assert.match(source, /request_capability/)
  assert.match(source, /release_capability/)
  assert.doesNotMatch(source, /D:\\AAAbiancheng|C:\\Users\\Rain/i)
  assert.doesNotMatch(source, /Intent Lens|Plan Critic|Council|automatic planner/i)
})

test('public staging includes the model-invisible request governor and isolation guard', () => {
  const governor = readFileSync(resolve(root, 'plugins/provider-request-governor/index.js'), 'utf8')
  const guard = readFileSync(resolve(root, 'src/isolation-guard.mjs'), 'utf8')
  assert.match(governor, /llm\/stream/u)
  assert.match(governor, /LIVE_PROVIDER_GLOBAL_BUDGET_EXHAUSTED/u)
  assert.match(governor, /LIVE_PROVIDER_TASK_BUDGET_EXHAUSTED/u)
  assert.match(governor, /DSH_HOME_ISOLATION_VIOLATION/u)
  assert.match(guard, /ISOLATION_SENTINEL_NAME/u)
  assert.doesNotMatch(governor, /D:\\AAAbiancheng|C:\\Users\\Rain/i)
})

test('public staging freezes compaction as inherited/experimental rather than a 0.68 default', () => {
  const profile = readFileSync(resolve(root, 'profile/agent.cordis.yml'), 'utf8')
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  assert.doesNotMatch(profile, /thresholdRatio\s*:\s*0\.68/u)
  assert.match(readme, /Experimental/u)
  assert.match(readme, /No custom `0\.68` compaction override/u)
})
