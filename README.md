# Minimal Omni GitHub Capability

`deepseek-harness-minimal-omni-github` is a developer-preview capability for
Minimal Omni. It exposes a deliberately small, allow-listed subset of GitHub
operations through the authenticated `gh` CLI. It is not a general shell
bridge and it does not read or emit credentials.

## Security model

- Read-only is the default. The only write operation currently exposed is
  `issue.create`, and it requires the explicit `--allow-write` flag.
- Arguments are constructed from validated owner/name, number, limit, title,
  and body fields. There is no arbitrary `gh` argument or shell escape hatch.
- The child process is started with `shell: false` and `GH_HOST=github.com`.
- Error output is bounded and scrubbed for credential-looking material before
  it reaches a caller.
- Authentication remains owned by `gh auth` (keyring/credential helper). Do
  not put tokens, passwords, or login files in this repository or in logs.

## Local use

Requirements: Node.js 20 or newer and GitHub CLI 2 or newer. Authenticate once
with the official CLI (`gh auth login`) and keep the login path in the CLI
credential store.

```text
npm test
npm run check
npm run verify-install
npm run secret-scan
node src/cli.mjs repo view owner/name
node src/cli.mjs issue list owner/name --limit 20
node src/cli.mjs issue create owner/name --title "fixture smoke" --body "safe" --allow-write
```

The package intentionally does not install a global `gh`, alter PATH, or
publish to npm. A pinned GitHub archive install (which does not require the
Git transport) is:

```text
npm install --global https://github.com/Rainflowers686/deepseek-harness-minimal-omni/archive/refs/tags/v0.1.0-preview.2.tar.gz
```

The equivalent pinned Git source is
`git+https://github.com/Rainflowers686/deepseek-harness-minimal-omni.git#v0.1.0-preview.2`.
If a local network blocks Git HTTPS while allowing GitHub API/archive traffic,
use the archive form; it contains the same reviewed tag.

For a reversible smoke test, use an isolated npm prefix instead of the global
prefix. To update, install a reviewed tag and rerun all four checks. To roll
back, reinstall the previous reviewed tag or remove only this package; the
GitHub CLI credential store is independent and is not modified by the package.

This release is a developer preview. It is not a promise of stable API
compatibility and it does not perform model calls.
