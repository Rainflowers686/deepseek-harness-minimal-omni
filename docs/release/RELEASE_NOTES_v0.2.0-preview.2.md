# Minimal Omni v0.2.0-preview.2

Developer Preview · Community packaging release

This release makes the existing Minimal Omni preview easier to install and
understand. It does not add a new model route or claim new modality coverage.

## Highlights

- One DSH Web bundle with one install command and one uninstall command.
- Minimal Omni appears as a selectable Agent preset without changing Standard.
- English and Simplified Chinese README and setup guides.
- Troubleshooting, compatibility, security, architecture, and contributor docs.
- Clean-user pack/install/remove/reinstall checks without provider calls.

## Current limits

- XLSX/PPTX model-facing workflows are Experimental.
- Goal continuity through compaction and automatic compaction tuning are
  Experimental.
- Vision depends on the selected route supporting image input.
- Web Search needs a configured search provider.
- Authenticated GitHub actions need explicit authorization.
- Desktop automation, ASR, broad audio/video semantics, and cross-Agent
  handoff are Deferred.

Tested DSH runtime: `dsh-v0.1.2-rc.1`
(`a66e4702047846cdaa10c66c9d3df3951f5ea70d`).
