import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const MAX_OUTPUT = 16_000
export const MAX_DOC_BYTES = 8 * 1024 * 1024

export function cleanText(value, max = MAX_OUTPUT) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 96))}\n[… output bounded by Minimal Omni …]`
}

export function confinedPath(root, raw, { mustExist = false } = {}) {
  if (typeof raw !== 'string' || raw.trim() === '') throw new Error('path must be a non-empty string')
  const workspace = resolve(root)
  const target = resolve(workspace, raw)
  const rel = relative(workspace, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('path is outside the selected workspace')
  if (mustExist && !existsSync(target)) throw new Error(`path does not exist: ${raw}`)
  return target
}

export function safeDownloadName(value) {
  const basename = String(value ?? 'download').split(/[\\/]+/u).pop() ?? 'download'
  const name = basename.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120)
  return name || 'download'
}

export function httpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//iu.test(value)) throw new Error('only HTTP(S) URLs are permitted')
  return value
}
