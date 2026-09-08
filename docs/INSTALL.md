# Install

## Prerequisites

- DeepSeek Harness `dsh-v0.1.2-rc.1` (the tested pin)
- Node.js 22.19 or newer
- PowerShell 7 on Windows

Minimal Omni is installed into the existing DSH `web` profile. No separate DSH
checkout, DSH_HOME, credential file, or manual profile edit is needed for a
normal community install.

## Install

```powershell
dsh plugin --profile web add github:Rainflowers686/deepseek-harness-minimal-omni#v0.2.0-preview.2
```

The package is a DSH bundle. The command keeps the official Web and Standard
layers and adds one Minimal Omni layer.

## Start and choose the preset

```powershell
dsh --profile web
```

Create a session and choose **Agent preset → Minimal Omni**. The install does
not change the default preset.

## Upgrade

When a newer preview is available, use the new release tag with the same
command. If the DSH version does not replace a GitHub dependency in place,
remove the old package first and then add the new pinned tag.

## Uninstall

```powershell
dsh plugin --profile web remove @rain/minimal-omni
```

The official profile manager removes the bundle and leaves other bundles,
presets, sessions, credentials, and provider settings alone.

## Windows and version pinning

Windows is the first supported platform. Pin a release tag instead of `#main`
when reproducibility matters. See [COMPATIBILITY.md](COMPATIBILITY.md) before
using another DSH build.

Maintainer-only acceptance launchers and strict home/request checks are kept
outside the normal install path; see [DEVELOPMENT.md](DEVELOPMENT.md).
