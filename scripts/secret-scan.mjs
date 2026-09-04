import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const excluded = new Set(['.git', 'node_modules', 'dist', 'coverage'])
const rules = [
  { id: 'github-token-prefix', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, severity: 'HIGH' },
  { id: 'github-pat-prefix', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, severity: 'HIGH' },
  { id: 'private-key-header', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
  { id: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, severity: 'HIGH' },
  { id: 'secret-assignment', re: /\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/gi, severity: 'HIGH' },
]

const findings = []
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) await walk(join(dir, entry.name))
      continue
    }
    if (!entry.isFile()) continue
    const path = join(dir, entry.name)
    let text
    try { text = await readFile(path, 'utf8') } catch { continue }
    for (const rule of rules) {
      rule.re.lastIndex = 0
      let match
      while ((match = rule.re.exec(text)) !== null) {
        const line = text.slice(0, match.index).split('\n').length
        findings.push({
          ruleId: rule.id,
          path: relative(root, path),
          line,
          matchHashPrefix: createHash('sha256').update(match[0]).digest('hex').slice(0, 12),
          severity: rule.severity,
        })
      }
    }
  }
}

await walk(root)
process.stdout.write(`${JSON.stringify({ root, findings, count: findings.length }, null, 2)}\n`)
if (findings.length > 0) process.exitCode = 1
