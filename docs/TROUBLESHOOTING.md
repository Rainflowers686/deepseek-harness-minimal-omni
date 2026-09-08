# Troubleshooting

## Minimal Omni is not in the preset selector

**Cause:** The bundle was installed into a different profile, or the Web
process was not restarted after installation.

**Fix:** Check `dsh plugin --profile web add ...` completed successfully, run
`dsh --profile web`, and look under **Agent preset**. Use the pinned release tag
from the install command.

## DSH version is incompatible

**Cause:** The preview is tested against `dsh-v0.1.2-rc.1` only.

**Fix:** Use the pinned runtime or report the DSH version and the exact error as
a compatibility issue. The alpha line is not silently treated as supported.

## Browser is unavailable

**Cause:** Browser is an on-demand capability and needs the Web runtime and its
local browser dependency.

**Fix:** Start the `web` profile, select Minimal Omni, and request Browser from
the task. Check the runtime log for a local browser installation error.

## Vision is unavailable for this route

**Cause:** The selected provider/model did not declare image-input support.

**Fix:** Use a route that documents image input. The package returns a
structured unavailable result instead of trying a second hidden model.

## Web Search is unavailable

**Cause:** Web Search needs a configured search provider. Web fetch is a
separate capability.

**Fix:** Configure the provider in DSH settings, then restart the Web profile.

## GitHub actions are unavailable

**Cause:** Authenticated GitHub operations need explicit authorization.

**Fix:** Configure GitHub credentials through the official DSH settings path.
Never post a token in an issue.

## Plugin add failed

**Cause:** The DSH CLI could not resolve the GitHub tag, pnpm is missing, or
the DSH version cannot install the package.

**Fix:** Check the tag spelling, network access to GitHub, and `dsh --version`.
Copy the command and the non-secret error into a compatibility issue.

## Uninstall or reinstall

**Fix:** Run:

```powershell
dsh plugin --profile web remove @rain/minimal-omni
dsh plugin --profile web add github:Rainflowers686/deepseek-harness-minimal-omni#v0.2.0-preview.2
```

The two commands affect only this bundle. They do not remove sessions or
credentials.

## How do I return to the official preset?

Open a new session and select **Standard** (or another installed official
preset). Removing Minimal Omni is optional.

## Issue reports

Include OS, DSH version, Minimal Omni version, install command, reproduction,
expected result, and actual result. Do not include API keys, cookies, or raw
session logs containing private data.
