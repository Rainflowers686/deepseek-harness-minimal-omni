import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import { apply as applyFs } from '@deepseek-ai/dsh-tool-fs'
import { apply as applySearch } from '@deepseek-ai/dsh-tool-fs-search'
import { apply as applyLsp } from '@deepseek-ai/dsh-tool-lsp'
import { apply as applyWeb } from '@deepseek-ai/dsh-tool-web'
import { apply as applyJobs } from '@deepseek-ai/dsh-tool-jobs'
import { apply as applyGoal } from '@deepseek-ai/dsh-tool-goal'
import { cleanText, confinedPath, httpUrl, safeDownloadName, MAX_DOC_BYTES, MAX_OUTPUT } from './boundaries.mjs'
import { evaluateVisionRoute, visionRouteFromExecution } from './vision-route-gate.mjs'

export const name = 'minimal-omni-capability-broker'
export const inject = ['tools']

const CAPABILITIES = ['code', 'web', 'browser', 'documents', 'jobs', 'long_task', 'vision', 'github', 'media']
const MAX_ZIP_ENTRIES = 2_000
// Direct plugin application bypasses schemastery's Config defaulting. Keep
// the official tool-fs positive defaults explicit so an on-demand Vision/Code
// mount cannot construct an invalid read_image/read configuration.
const TOOL_FS_DEFAULTS = {
  readLimit: 2_000,
  readMaxLineLength: 2_000,
  readMaxBytes: 50 * 1024,
  readStreamMinSize: 10 * 1024 * 1024,
}
const active = new WeakMap()

function stateFor(agent) {
  let state = active.get(agent)
  if (!state) {
    state = { mounted: new Map(), disposers: [], browser: null, jobs: new Map() }
    active.set(agent, state)
  }
  return state
}

function agentContext(exec, fallback) {
  return exec?.agent?.ctx ?? fallback
}

function jsonOutput(value) {
  return [{ type: 'text', text: cleanText(JSON.stringify(value, null, 2)) }]
}

function schemaObject(properties, required = []) {
  const normalized = { ...properties }
  for (const name of required) {
    if (normalized[name] && typeof normalized[name] === 'object') normalized[name] = { ...normalized[name], required: true }
  }
  return { type: 'object', additionalProperties: false, properties: normalized }
}

function workspaceRoot(exec) {
  const value = exec?.agent?.session?.cwd?.() ?? process.env.DSH_CWD ?? process.cwd()
  return resolve(value)
}

function boundedFileInfo(target) {
  const info = statSync(target)
  return { path: target, bytes: info.size, modifiedAt: new Date(info.mtimeMs).toISOString(), directory: info.isDirectory() }
}

function registerScoped(ctx, definition) {
  const disposer = ctx.tools.register(defineTool(definition))
  return typeof disposer === 'function' ? disposer : () => {}
}

async function loadPlaywright() {
  const configured = process.env.DSH_PLAYWRIGHT_MODULE
  if (configured && existsSync(configured)) return import(pathToFileURL(configured).href)
  try {
    // Resolve through the active runtime first.  The workstation launcher may
    // provide DSH_PLAYWRIGHT_MODULE, while a clean install can use the normal
    // package resolver.  No workstation-specific absolute fallback belongs in
    // the published capability implementation.
    return await import('playwright')
  } catch {
    throw new Error('Playwright is not available in the current execution environment; set DSH_PLAYWRIGHT_MODULE or install playwright')
  }
}

async function browserState(state) {
  if (state.browser?.context) return state.browser
  const { chromium } = await loadPlaywright()
  const base = resolve(process.env.DSH_HOME ?? process.cwd(), 'capabilities', 'browser')
  const profile = join(base, 'profile')
  const downloads = join(base, 'downloads')
  mkdirSync(profile, { recursive: true })
  mkdirSync(downloads, { recursive: true })
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chrome',
    acceptDownloads: true,
    downloadsPath: downloads,
  })
  const page = context.pages()[0] ?? await context.newPage()
  state.browser = { context, page, profile, downloads }
  return state.browser
}

async function closeBrowser(state) {
  if (!state.browser) return false
  try { await state.browser.context.close() } finally { state.browser = null }
  return true
}

function browserTools(ctx, state) {
  const common = { timeoutMs: 60_000 }
  const tools = []
  tools.push(registerScoped(ctx, {
    name: 'browser_navigate', description: 'Navigate the isolated browser to an HTTP(S) URL.',
    parameters: { url: { type: 'string', required: true } },
    output: { schema: schemaObject({ url: { type: 'string', required: true }, title: { type: 'string', required: true } }, ['url', 'title']), render: (_a, v) => jsonOutput(v) },
    ...common,
    async execute(args) { const url = httpUrl(args.url); const b = await browserState(state); await b.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }); return { url: b.page.url(), title: await b.page.title() } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_snapshot', description: 'Return a bounded text snapshot of the isolated browser page.',
    parameters: {}, output: { schema: schemaObject({ url: { type: 'string', required: true }, text: { type: 'string', required: true } }, ['url', 'text']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute() { const b = await browserState(state); return { url: b.page.url(), text: cleanText(await b.page.locator('body').innerText()) } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_click', description: 'Click a visible text or CSS selector in the isolated browser.',
    parameters: { selector: { type: 'string', required: true } }, output: { schema: schemaObject({ clicked: { type: 'string', required: true } }, ['clicked']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute(args) { const b = await browserState(state); await b.page.locator(args.selector).first().click({ timeout: 30_000 }); return { clicked: args.selector } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_type', description: 'Fill a visible input in the isolated browser.',
    parameters: { selector: { type: 'string', required: true }, text: { type: 'string', required: true } }, output: { schema: schemaObject({ typed: { type: 'string', required: true } }, ['typed']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute(args) { const b = await browserState(state); await b.page.locator(args.selector).first().fill(args.text); return { typed: args.selector } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_download', description: 'Download from a page into the isolated DSH_HOME download root.',
    parameters: { selector: { type: 'string', required: true } }, output: { schema: schemaObject({ path: { type: 'string', required: true }, bytes: { type: 'integer', required: true } }, ['path', 'bytes']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute(args) { const b = await browserState(state); const [download] = await Promise.all([b.page.waitForEvent('download', { timeout: 30_000 }), b.page.locator(args.selector).first().click()]); const target = join(b.downloads, safeDownloadName(download.suggestedFilename())); await download.saveAs(target); const info = await stat(target); return { path: target, bytes: info.size } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_screenshot', description: 'Save a screenshot inside the isolated DSH_HOME capability directory.',
    parameters: { name: { type: 'string' } }, output: { schema: schemaObject({ path: { type: 'string', required: true }, bytes: { type: 'integer', required: true } }, ['path', 'bytes']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute(args) { const b = await browserState(state); const safe = String(args.name ?? 'page').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80); const target = join(resolve(process.env.DSH_HOME ?? process.cwd(), 'capabilities', 'browser', 'screenshots'), `${safe || 'page'}.png`); mkdirSync(dirname(target), { recursive: true }); await b.page.screenshot({ path: target, fullPage: false }); return { path: target, bytes: (await stat(target)).size } },
  }))
  tools.push(registerScoped(ctx, {
    name: 'browser_close', description: 'Close the isolated browser and its owned pages.',
    parameters: {}, output: { schema: schemaObject({ closed: { type: 'boolean', required: true } }, ['closed']), render: (_a, v) => jsonOutput(v) }, ...common,
    async execute() { return { closed: await closeBrowser(state) } },
  }))
  return tools
}

function xmlText(xml) {
  return cleanText(xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\s+/g, ' ').trim(), 24_000)
}

async function zipEntries(target) {
  const script = '& { param($p); Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($p); try { $z.Entries | Select-Object -First 2000 FullName,Length,LastWriteTime | ConvertTo-Json -Compress } finally { $z.Dispose() } }'
  const pwsh = process.env.DSH_PWSH_COMMAND ?? 'pwsh'
  const { execFile } = await import('node:child_process')
  return new Promise((resolvePromise, reject) => execFile(pwsh, ['-NoProfile', '-NonInteractive', '-Command', script, target], { windowsHide: true, maxBuffer: 2_000_000 }, (error, stdout, stderr) => { if (error) reject(new Error(cleanText(stderr || error.message))); else resolvePromise(stdout) }))
}

async function documentRead(target, ext) {
  const bytes = statSync(target).size
  if (bytes > MAX_DOC_BYTES) throw new Error('document exceeds bounded extraction limit')
  if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv' || ext === '.m') return cleanText(await readFile(target, 'utf8'), 24_000)
  if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
    const raw = await zipEntries(target)
    return cleanText(raw, 24_000)
  }
  if (ext === '.pdf') {
    const { execFile } = await import('node:child_process')
    const pdftotext = process.env.DSH_PDFTOTEXT_COMMAND ?? 'pdftotext'
    return new Promise((resolvePromise, reject) => execFile(pdftotext, ['-f', '1', '-l', '20', '-layout', target, '-'], { windowsHide: true, maxBuffer: 2_000_000 }, (error, stdout, stderr) => { if (error) reject(new Error(cleanText(stderr || error.message))); else resolvePromise(cleanText(stdout, 24_000)) }))
  }
  if (ext === '.zip') return cleanText(await zipEntries(target), 24_000)
  throw new Error(`unsupported document type: ${ext || '(no extension)'}`)
}

function documentTools(ctx) {
  const common = { timeoutMs: 60_000 }
  return [
    registerScoped(ctx, { name: 'document_inspect', description: 'Inspect bounded metadata for a document inside the workspace.', parameters: { file_path: { type: 'string', required: true } }, output: { schema: schemaObject({ path: { type: 'string', required: true }, bytes: { type: 'integer', required: true }, modifiedAt: { type: 'string', required: true }, extension: { type: 'string', required: true } }, ['path', 'bytes', 'modifiedAt', 'extension']), render: (_a, v) => jsonOutput(v) }, ...common, async execute(args, exec) { const target = confinedPath(exec, args.file_path, { mustExist: true }); const info = boundedFileInfo(target); return { ...info, extension: extname(target).toLowerCase() } } }),
    registerScoped(ctx, { name: 'document_list', description: 'List bounded ZIP or Office package contents without extracting them.', parameters: { file_path: { type: 'string', required: true } }, output: { schema: schemaObject({ path: { type: 'string', required: true }, entries: { type: 'array', required: true, items: { type: 'object' } } }, ['path', 'entries']), render: (_a, v) => jsonOutput(v) }, ...common, async execute(args, exec) { const target = confinedPath(exec, args.file_path, { mustExist: true }); const ext = extname(target).toLowerCase(); if (!['.zip', '.docx', '.xlsx', '.pptx'].includes(ext)) throw new Error('document_list supports ZIP/DOCX/XLSX/PPTX'); const parsed = JSON.parse(await zipEntries(target)); return { path: target, entries: Array.isArray(parsed) ? parsed : [parsed] } } }),
    registerScoped(ctx, { name: 'document_extract', description: 'Extract bounded text or package metadata from a document.', parameters: { file_path: { type: 'string', required: true } }, output: { schema: schemaObject({ path: { type: 'string', required: true }, text: { type: 'string', required: true } }, ['path', 'text']), render: (_a, v) => jsonOutput(v) }, ...common, async execute(args, exec) { const target = confinedPath(exec, args.file_path, { mustExist: true }); return { path: target, text: await documentRead(target, extname(target).toLowerCase()) } } }),
  ]
}

function jobTools(ctx, state) {
  const common = { timeoutMs: 60_000 }
  const jobs = ctx.get('jobs')
  const subprocess = ctx.get('subprocess')
  if (!jobs || !subprocess) throw new Error('jobs capability requires official jobs and subprocess services')
  const tools = []
  tools.push(registerScoped(ctx, { name: 'job_start', description: 'Start an owned, bounded PowerShell job in the workspace.', parameters: { script: { type: 'string', required: true }, label: { type: 'string' } }, output: { schema: schemaObject({ id: { type: 'string', required: true }, status: { type: 'string', required: true } }, ['id', 'status']), render: (_a, v) => jsonOutput(v) }, ...common, execute(args, exec) { const controller = new AbortController(); const cwd = workspaceRoot(exec); const script = String(args.script); const handle = subprocess.spawn({ argv: [process.env.DSH_PWSH_COMMAND ?? 'pwsh', '-NoProfile', '-NonInteractive', '-Command', script], cwd, graceMs: 2_000, signal: controller.signal, stdio: { stdin: 'ignore', stdout: { maxBytes: 32_000 }, stderr: { maxBytes: 16_000 } } }); const id = jobs.start({ kind: 'bash', label: String(args.label ?? 'Minimal Omni PowerShell job').slice(0, 160), outputLimitBytes: 32_000, owner: exec.agent, run: () => ({ cancel: () => { controller.abort(); handle.terminate() }, done: handle.done.then(async outcome => ({ status: outcome.exitCode === 0 ? 'completed' : 'failed', detail: `exit code: ${outcome.exitCode ?? 'signal'}`, output: cleanText(`${handle.collected.stdout?.readFrom(0).text ?? ''}${handle.collected.stderr?.readFrom(0).text ?? ''}`, 32_000) })), readOutput: () => cleanText(`${handle.collected.stdout?.readFrom(0).text ?? ''}${handle.collected.stderr?.readFrom(0).text ?? ''}`, 32_000) }) }); state.jobs.set(String(id), { id: String(id), controller, handle }); return Promise.resolve({ id: String(id), status: 'running' }) } } ))
  tools.push(registerScoped(ctx, { name: 'job_wait', description: 'Wait for an owned job to reach a terminal state and return bounded output.', parameters: { job_id: { type: 'string', required: true }, timeout_ms: { type: 'number' } }, output: { schema: schemaObject({ id: { type: 'string', required: true }, status: { type: 'string', required: true }, output: { type: 'string', required: true } }, ['id', 'status', 'output']), render: (_a, v) => jsonOutput(v) }, ...common, async execute(args, exec) { const id = String(args.job_id); const snapshot = await jobs.wait(id, Math.min(Number(args.timeout_ms ?? 60_000), 120_000), exec.agent, exec.signal); const read = jobs.read(id, exec.agent); return { id, status: snapshot.status, output: cleanText(read.text, 32_000) } } } ))
  tools.push(registerScoped(ctx, { name: 'job_cancel', description: 'Cancel an owned job and return its terminal status when available.', parameters: { job_id: { type: 'string', required: true } }, output: { schema: schemaObject({ id: { type: 'string', required: true }, outcome: { type: 'string', required: true } }, ['id', 'outcome']), render: (_a, v) => jsonOutput(v) }, ...common, execute(args, exec) { const id = String(args.job_id); const outcome = jobs.kill(id, exec.agent, 'cancelled by model'); return Promise.resolve({ id, outcome }) } } ))
  return tools
}

function capabilityApply(agentCtx, capability, state, options = {}) {
  if (capability === 'vision') {
    const decision = evaluateVisionRoute(options.route)
    if (!decision.available) return decision
  }
  if (state.mounted.has(capability)) return state.mounted.get(capability).tools
  const scope = createScope(agentCtx, {}, { parent: scopeOf(agentCtx) })
  const target = scope.ctx
  const tools = []
  if (capability === 'code') {
    applyFs(target, TOOL_FS_DEFAULTS)
    applySearch(target, { sampleOverCapGlobResults: false })
    applyLsp(target, {})
    state.mounted.set(capability, { scope, tools: ['read', 'write', 'edit', 'glob', 'grep', 'lsp'] })
    return ['read', 'write', 'edit', 'glob', 'grep', 'lsp']
  }
  if (capability === 'vision') {
    applyFs(target, TOOL_FS_DEFAULTS)
    state.mounted.set(capability, { scope, tools: ['read_image'] })
    return ['read_image']
  }
  if (capability === 'web') {
    applyWeb(target, { fetch: true, search: false, fetchTimeoutMs: 30_000, fetchMaxOutputChars: 200_000 })
    state.mounted.set(capability, { scope, tools: ['web_fetch'] })
    return ['web_fetch']
  }
  if (capability === 'browser') {
    const disposers = browserTools(target, state)
    state.mounted.set(capability, { scope, disposers, tools: ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_download', 'browser_screenshot', 'browser_close'] })
    return state.mounted.get(capability).tools
  }
  if (capability === 'documents') {
    const disposers = documentTools(target)
    state.mounted.set(capability, { scope, disposers, tools: ['document_inspect', 'document_list', 'document_extract'] })
    return state.mounted.get(capability).tools
  }
  if (capability === 'jobs') {
    applyJobs(target, { completionDelivery: 'quiet', maxWaitTimeoutMs: 120_000 })
    const disposers = jobTools(target, state)
    state.mounted.set(capability, { scope, disposers, tools: ['job_start', 'job_wait', 'job_cancel', 'job_list', 'job_output', 'job_kill'] })
    return state.mounted.get(capability).tools
  }
  if (capability === 'long_task') {
    applyGoal(target, {})
    state.mounted.set(capability, { scope, tools: ['goal'] })
    return ['goal']
  }
  if (capability === 'media') {
    state.mounted.set(capability, { scope, tools: [], note: 'Media remains optional in this preview; use ffprobe/ffmpeg through pwsh with explicit bounded paths.' })
    return []
  }
  if (capability === 'github') {
    state.mounted.set(capability, { scope, tools: [], note: 'GitHub is optional and not enabled without configured provider support.' })
    return []
  }
  throw new Error(`unknown capability: ${capability}`)
}

function releaseCapability(agentCtx, capability, state) {
  const current = state.mounted.get(capability)
  if (!current) return false
  if (capability === 'browser') void closeBrowser(state)
  state.mounted.delete(capability)
  if (current.disposers) for (const dispose of [...current.disposers].reverse()) { try { dispose() } catch {} }
  if (current.scope) void current.scope.dispose()
  return true
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'request_capability',
    description: 'Request one bounded capability for this agent only. Capabilities are leased on demand and are model-visible only while active.',
    parameters: { capability: { type: 'string', required: true, enum: CAPABILITIES } },
    output: { schema: schemaObject({ capability: { type: 'string', required: true }, enabled: { type: 'boolean', required: true }, tools: { type: 'array', required: true, items: { type: 'string' } }, note: { type: 'string' }, status: { type: 'string' }, code: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' }, requiredCapability: { type: 'string' } }, ['capability', 'enabled', 'tools']), render: (_a, v) => jsonOutput(v) },
    async execute(args, exec) {
      const state = stateFor(exec.agent)
      const target = agentContext(exec, ctx)
      const route = args.capability === 'vision' ? visionRouteFromExecution(exec) : undefined
      const result = capabilityApply(target, args.capability, state, { route })
      if (result && typeof result === 'object' && result.available === false) {
        return { capability: args.capability, enabled: false, tools: [], status: result.status, code: result.code, provider: result.provider, model: result.model, requiredCapability: result.requiredCapability }
      }
      const tools = result
      return { capability: args.capability, enabled: true, tools, ...(state.mounted.get(args.capability)?.note ? { note: state.mounted.get(args.capability).note } : {}) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'release_capability',
    description: 'Release a previously leased capability and its owned resources.',
    parameters: { capability: { type: 'string', required: true, enum: CAPABILITIES } },
    output: { schema: schemaObject({ capability: { type: 'string', required: true }, released: { type: 'boolean', required: true } }, ['capability', 'released']), render: (_a, v) => jsonOutput(v) },
    async execute(args, exec) { const state = stateFor(exec.agent); const released = releaseCapability(agentContext(exec, ctx), args.capability, state); return { capability: args.capability, released } },
  }))
}
