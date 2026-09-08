# Minimal Omni

Keep DeepSeek Harness minimal by default. When a task needs a browser,
documents, or code navigation, Minimal Omni lets the session request that
capability and release it when the task is done.

[English](README.md) · [简体中文](README.zh-CN.md)

Minimal Omni is an independent Developer Preview for DeepSeek Harness. It
does not replace the official Web app or change your provider settings.

## Why use it?

| | A large tool setup | Minimal Omni |
| --- | --- | --- |
| Tools visible at idle | Many, depending on the setup | `pwsh`, `str_replace_editor`, `request_capability`, `release_capability` |
| Browser | Always present or configured separately | Requested only when needed |
| Documents | Depends on the setup | Requested only when needed |
| Planning or reviewer prompts | Depends on the setup | None added by this package |
| Uninstall | Varies by setup | One DSH plugin command |

The model remains the official Minimal brain. The surrounding runtime supplies
the tools and cleanup; it does not add a planner or a review loop.

## Install

Run this once in the DSH environment you already use:

```powershell
dsh plugin --profile web add github:Rainflowers686/deepseek-harness-minimal-omni#v0.2.0-preview.2
```

The command adds one bundle to the existing `web` profile. It does not change
the default preset, provider, model, credentials, proxy, or permissions.

## Use

Start the normal Web profile:

```powershell
dsh --profile web
```

Create a new session, open **Agent preset**, and select **Minimal Omni**.
Standard and other installed presets remain available.

For a coding task, the idle surface stays small. If the task needs a current
web page, a PDF, or repository navigation, the session can request Browser,
Documents, or Code/LSP for that task and release it afterwards.

## Uninstall

```powershell
dsh plugin --profile web remove @rain/minimal-omni
```

Removing the bundle leaves the rest of the Web profile and your sessions and
credentials in place. Install the pinned command again if you want to return.

## What is included

See the [capability matrix](docs/CAPABILITY_MATRIX.md) for the evidence-based
support tiers. In brief, this preview includes the Minimal brain, on-demand
Code/LSP, Browser, Web fetch, PDF/DOCX/ZIP extraction, Jobs, native Goal and
manual `/compact`, session reload, and an integrated coding path.

XLSX and PPTX model-facing workflows, Goal continuity across a successful
compaction, automatic compaction tuning, and optional media extraction are
Experimental. Vision is Conditional on the selected route supporting image
input. Web Search and authenticated GitHub actions need their own provider or
authorization. Desktop automation, ASR, broad audio/video understanding, and
cross-Agent handoff are Deferred.

Minimal Omni does not ship a custom `0.68` compaction override as a stable
default; automatic compaction tuning remains Experimental.

## Compatibility

The tested runtime is `dsh-v0.1.2-rc.1` at commit
`a66e4702047846cdaa10c66c9d3df3951f5ea70d`. Windows is the first supported
platform. See [COMPATIBILITY.md](docs/COMPATIBILITY.md) before trying another
DSH build.

## Security notes

- Capability tools use the current session workspace and bounded output.
- Browser profiles, downloads, screenshots, and jobs are owned by the runtime.
- Known unsupported Vision routes are rejected before an image tool is used.
- Acceptance/CI mode has stricter request and home-isolation checks; normal
  community use does not require an acceptance ledger or an artificial request
  budget.
- Do not paste API keys, cookies, or private session logs into an issue.

More detail is in [SECURITY.md](docs/SECURITY.md) and
[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Development

Read [DEVELOPMENT.md](docs/DEVELOPMENT.md) for local package tests and the
maintainer-only acceptance mode. No provider key is needed for the static and
packaging checks.

## License

MIT. See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md),
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and
[PROVENANCE.md](PROVENANCE.md).
