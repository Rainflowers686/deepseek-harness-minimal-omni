import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateVisionRoute } from '../plugins/capability-broker/vision-route-gate.mjs'

test('public preview blocks the known unsupported route before read_image is mounted', () => {
  const result = evaluateVisionRoute({ provider: 'deepseek-anthropic', model: 'deepseek-v4-pro[1m]' })
  assert.equal(result.available, false)
  assert.equal(result.code, 'CAPABILITY_UNAVAILABLE_FOR_ROUTE')
  assert.equal(result.requiredCapability, 'image-input')
})

test('public preview keeps unknown vision routes unverified', () => {
  const result = evaluateVisionRoute({ provider: 'custom-provider', model: 'custom-model' })
  assert.equal(result.available, false)
  assert.equal(result.code, 'CAPABILITY_ROUTE_UNVERIFIED')
})
