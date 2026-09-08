# Capability matrix

This is the public-preview contract, not a promise that every capability works
on every provider route.

| Tier | Capability | Boundary |
|---|---|---|
| Supported / live-tested | Official Minimal brain, `pwsh`, `str_replace_editor`, capability broker | Minimal persona and idle surface are preserved. |
| Supported / live-tested | Code/LSP, Web fetch, Browser | On-demand, bounded, isolated roots. |
| Supported / live-tested | PDF, DOCX, ZIP Documents | Metadata/list/bounded extraction; no high-fidelity Office editing claim. |
| Supported / live-tested | Jobs, native Goal, native manual `/compact`, reload continuation, integrated coding | Listed lifecycle evidence exists. |
| Supported / live-tested | Provider Request Governor, `DSH_HOME` Guard, Tool/Turn boundaries, watchdog, owned cleanup | Model-invisible, fail-closed acceptance safety. |
| Supported / live-tested | Install, doctor, rollback | Windows-first explicit-root workflow. |
| Experimental | XLSX/PPTX model-facing workflows | Backend fixtures pass; live model-facing targeting is not independently certified. |
| Experimental | Goal continuity across successful compaction | Native lifecycle passes; active-Goal survival through successful compact is not independently live-proven. |
| Experimental | Automatic compaction tuning/threshold behavior | No stable Minimal Omni `0.68` override is shipped. |
| Experimental | Media metadata/frame extraction | Optional external FFmpeg/FFprobe only. |
| Conditional | Vision | Selected route must declare image input; unsupported routes are blocked before `read_image`. |
| Conditional | Web Search | Requires a configured search provider. |
| Conditional | Authenticated GitHub actions | Requires explicit GitHub authorization. |
| Deferred | Desktop automation, ASR, broad audio/video understanding, cross-Agent handoff | Outside this preview. |

The acceptance route `deepseek-anthropic / deepseek-v4-pro[1m]` rejected inline
image input before provider dispatch; Vision is therefore route-conditional.
