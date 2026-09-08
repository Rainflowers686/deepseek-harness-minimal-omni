# Development

## Supported pin

Use `dsh-v0.1.2-rc.1` at commit
`a66e4702047846cdaa10c66c9d3df3951f5ea70d`. Keep the upstream checkout
read-only when working on this package.

## Local checks

From the package root:

```powershell
pnpm test
pnpm pack --pack-destination $env:TEMP
```

The public CI runs Node syntax checks, package manifest checks, documentation
link checks, secret/path scans, and a pack/install smoke test. It never calls a
provider.

## Maintainer acceptance mode

Strict DSH_HOME isolation, process attestation, provider request accounting,
and hard request caps are enabled only by an explicit acceptance launcher.
Normal community startup must continue to work without those variables.

Never commit a provider key, session body, raw provider response, acceptance
ledger, or an absolute private workstation path.

## Adding a capability

Keep the idle surface small. Add a capability group only when it has a clear
request/release lifecycle, bounded results, owned cleanup, and a route or
provider limitation that can be stated in the capability matrix. Do not add a
planner, reviewer, or automatic workflow to make a capability appear easier.
