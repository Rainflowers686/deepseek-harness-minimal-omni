# Usage

Minimal Omni is selected per session. It does not turn every session in the
Web profile into Minimal Omni.

## A coding task

Start with the four small visible tools: `pwsh`,
`str_replace_editor`, `request_capability`, and `release_capability`. Code/LSP
is requested only when repository navigation or symbols are useful.

## A current web page

Ask for the page as part of the task. The session can request Browser or Web
fetch, use it, and release it. A configured search provider is required for Web
Search; Web fetch does not imply search access.

## A PDF or office document

The session can request Documents and inspect bounded metadata or text. PDF,
DOCX, and ZIP are in the live-tested tier. XLSX and PPTX model-facing flows
remain Experimental.

## Jobs and longer work

Jobs are owned by the current runtime and return bounded output. Goal and the
native `/compact` command are available. Goal continuity through a successful
compaction and automatic compaction tuning remain Experimental.

## Vision and GitHub

Vision is Conditional: the selected provider route must declare image input.
Authenticated GitHub actions require explicit GitHub configuration and
authorization. Minimal Omni does not add a second model or silently route the
request elsewhere.

Most users never need to call `request_capability` directly; the session can
choose it when the task calls for an extra capability.
