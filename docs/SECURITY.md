# Security

## Normal community use

- The package uses the user's existing DSH_HOME and Web profile; it does not
  ask for an isolated home or an acceptance ledger.
- It does not change provider settings, credentials, proxies, default presets,
  or permissions.
- Capability leases are scoped to the current agent and session workspace.
- Browser profiles, downloads, screenshots, jobs, and child processes are
  owned and cleaned up by the runtime.
- Unsupported Vision routes are rejected before `read_image`; there is no
  hidden second model.

## Maintainer acceptance mode

CI and maintainer validation can explicitly enable the Provider Request
Governor, DSH_HOME guard, fresh process attestation, and shared ledger. Those
checks are release tooling, not a hidden budget for ordinary users. The
governor remains model-invisible: it does not add planning, reflection,
reviewer, or budget coaching to prompts or tool schemas.

## Reporting

Do not include API keys, cookies, credentials, private paths, provider
responses, or raw session logs in issues. See the issue templates for the
minimum compatibility information needed to reproduce a problem.
