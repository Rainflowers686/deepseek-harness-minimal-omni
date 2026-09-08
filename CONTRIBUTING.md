# Contributing

Minimal Omni targets the pinned DSH preview runtime first.

## Before opening a change

- Reproduce on Windows with DSH `dsh-v0.1.2-rc.1`.
- Run the package tests and the pack/install smoke test.
- Run the public-path and secret scans.
- Run `git diff --check`.
- Do not use provider keys for static or packaging checks.

## Adding a capability

Keep the idle tool list small. A new capability needs:

- an on-demand request and release path;
- bounded output;
- owned process and file cleanup;
- a clear support tier and compatibility note;
- a deterministic local test.

Do not add planner, reviewer, automatic workflow, or automatic memory behavior.

## Reporting compatibility regressions

Include OS, DSH version, Minimal Omni version, install command, reproduction,
expected result, and actual result. Never include API keys, cookies, credentials,
or raw session logs with private data.

## License

By contributing, you agree that your contribution is released under the
project's MIT license.
