# Provenance

Minimal Omni source is authored for the independent community project. The
official DSH runtime remains an external dependency, tested at
`dsh-v0.1.2-rc.1` / `a66e4702047846cdaa10c66c9d3df3951f5ea70d`. The capability
broker imports official DSH tool APIs and does not copy upstream source files.
The public bundle carries its own patch, preset, and broker modules; DSH loads
them through the standard profile-bundle interface. Research and local
runtime state are excluded. Vision route gating is a Minimal Omni fail-closed
adaptation; it does not add a second model or router.
