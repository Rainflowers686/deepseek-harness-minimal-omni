import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
const manifest = JSON.parse(await readFile(join(packageRoot, 'dsh-capability.json'), 'utf8'))
if (packageJson.name !== 'deepseek-harness-minimal-omni-github') throw new Error('unexpected package identity')
if (manifest.transport !== 'github-cli' || manifest.defaultMode !== 'read-only') throw new Error('unexpected capability policy')
await access(join(packageRoot, 'src', 'cli.mjs'), constants.R_OK)
await access(join(packageRoot, 'src', 'gh-client.mjs'), constants.R_OK)
process.stdout.write(JSON.stringify({ package: packageJson.name, version: packageJson.version, capability: manifest.id, status: 'PASS' }) + '\n')
