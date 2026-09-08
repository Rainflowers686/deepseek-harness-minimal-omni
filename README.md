# DeepSeek Harness Minimal Omni — Developer Preview

Minimal Omni keeps the official Minimal brain small and leases bounded
environmental capabilities only when requested. The public preview is a
Windows-first composition for the pinned DeepSeek Harness runtime. “Omni” is
an architectural direction, not a promise that every provider and modality is
fully certified.

## Quick start

Use an isolated DSH checkout, an explicit task workspace, and an explicit
isolated `DSH_HOME`:

```powershell
pwsh -NoProfile -File install/install-minimal-omni.ps1 `
  -DshRoot <isolated-dsh-checkout> `
  -DshHome <isolated-dsh-home>
pwsh -NoProfile -File install/start-minimal-omni.ps1 `
  -Workspace <task-workspace> `
  -DshHome <isolated-dsh-home>
```

The launcher rejects the user's default `.dsh`, verifies a fresh isolation
sentinel, and owns the child process tree. Stop and rollback with the supplied
scripts and the same explicit roots.

## Compatibility

Supported pin: `dsh-v0.1.2-rc.1`
(`a66e4702047846cdaa10c66c9d3df3951f5ea70d`). The alpha line is not silently
claimed compatible.

## Capability tiers

**Supported / live-tested:** Official Minimal brain, `pwsh`,
`str_replace_editor`, capability-on-demand, Code/LSP, Web fetch, Browser, PDF
and DOCX and ZIP documents, Jobs, native Goal, native manual `/compact`,
session reload continuation, integrated coding, Provider Request Governor,
`DSH_HOME` Isolation Guard, Tool Execution Boundary, Turn Governor, external
watchdog, owned-process cleanup, install/doctor/rollback.

**Experimental:** XLSX/PPTX model-facing workflows, Goal continuity across a
successful compaction, automatic compaction tuning/threshold behavior, and
optional media metadata/frame extraction. No custom `0.68` compaction override
is shipped as a stable default.

**Conditional:** Vision requires an image-capable selected route; Web Search
requires a configured search provider; authenticated GitHub actions require
explicit GitHub authorization.

**Deferred:** Windows desktop automation, ASR, broad audio/video semantic
understanding, and cross-Agent handoff/portability.

## Governance and security

The Provider Request Governor admits every provider stream before dispatch in
acceptance mode, including retries, Goal, compaction, and auxiliary calls.
Tool/turn/watchdog boundaries, bounded outputs, explicit workspace roots,
child-side `DSH_HOME` attestation, owned-process cleanup, and factual first-aid
metadata are runtime controls. They do not inject planning, reflection,
reviewer, workflow, or budget instructions into the model.

Credentials, sessions, raw provider responses, private projects, research
traces, and absolute workstation paths are excluded from this staging tree.

## License

MIT. See `LICENSE`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, and `PROVENANCE.md`.
