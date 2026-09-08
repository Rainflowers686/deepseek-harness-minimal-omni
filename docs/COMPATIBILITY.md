# Compatibility

- Windows is the first supported platform; other operating systems are not
  claimed without evidence.
- Pinned DSH: `dsh-v0.1.2-rc.1`, commit
  `a66e4702047846cdaa10c66c9d3df3951f5ea70d`.
- Node 22.19+ and PowerShell 7 are required by the package/runtime workflow.
- `dsh-v0.1.3-alpha.1` is an isolated compatibility target only; its
  SessionHandle/session-format changes are not claimed supported.
- Provider/model behavior is route-dependent. Vision needs declared image
  input; Web Search needs an explicit search provider.

Upgrade only after a new isolated build and acceptance run. The preview does
not silently follow an alpha or `master` checkout.
