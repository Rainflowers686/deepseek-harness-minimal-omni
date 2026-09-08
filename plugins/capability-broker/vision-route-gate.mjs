const text = value => typeof value === 'string' ? value.trim() : ''

const routeKey = (provider, model) => `${text(provider).toLowerCase()}/${text(model).toLowerCase()}`

// This is intentionally a small, explicit deny/allow table.  It is not a
// model router and it does not infer image support from a model name.  Routes
// not present in the table remain unverified and are kept fail-closed.
const KNOWN_UNSUPPORTED = new Set([
  'deepseek-anthropic/deepseek-v4-pro[1m]',
])

function firstString(...values) {
  for (const value of values) {
    const candidate = text(value)
    if (candidate) return candidate
  }
  return ''
}

export function resolveVisionRoute(source = {}) {
  const provider = firstString(
    source.provider,
    source.providerId,
    source.selected?.provider,
    source.modelSelection?.provider,
    source.options?.provider,
    process.env.DSH_PROVIDER,
    process.env.DEEPSEEK_PROVIDER,
  )
  const model = firstString(
    source.model,
    source.modelId,
    source.selected?.model,
    source.modelSelection?.model,
    source.options?.model,
    process.env.DSH_MODEL,
    process.env.DEEPSEEK_MODEL,
    process.env.ANTHROPIC_MODEL,
  )
  return { provider, model }
}

export function visionRouteFromExecution(exec) {
  const agent = exec?.agent
  const session = agent?.session
  const route = resolveVisionRoute({
    provider: agent?.options?.provider,
    model: agent?.options?.model,
    options: session?.options,
    selected: session?.selectedModel ?? session?.modelSelection,
    modelSelection: session?.modelSelection,
  })
  const selected = session?.selectedModel ?? session?.modelSelection
  return {
    ...route,
    imageInput: agent?.options?.imageInput === true || session?.options?.imageInput === true || selected?.imageInput === true,
    capabilities: selected?.capabilities,
  }
}

export function evaluateVisionRoute(source = {}) {
  const { provider, model } = resolveVisionRoute(source)
  const key = routeKey(provider, model)
  const facts = { provider: provider || null, model: model || null, requiredCapability: 'image-input' }
  if (KNOWN_UNSUPPORTED.has(key)) {
    return { available: false, status: 'unsupported', code: 'CAPABILITY_UNAVAILABLE_FOR_ROUTE', ...facts }
  }
  const explicitlyDeclared = source.imageInput === true || source.capabilities?.imageInput === true
  if (explicitlyDeclared) {
    return { available: true, status: 'supported', code: null, ...facts }
  }
  return { available: false, status: 'unknown', code: 'CAPABILITY_ROUTE_UNVERIFIED', ...facts }
}
