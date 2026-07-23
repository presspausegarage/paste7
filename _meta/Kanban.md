---
kanban-plugin: board
type: kanban
parent: "[[apps-paste7]]"
tags:
  - type/kanban
  - app/paste7
---

> Registry: [[apps-paste7]]

## Backlog

- Phase 4: in-memory invariant lint coverage for `ocr/**` once Phase 6 lands (today's `npm run lint:in-memory` only checks `scratchpad/**` + `dicom/**`)
- Phase 4: code signing -- explicitly deferred (unsigned pilot ships with SmartScreen "More info -> Run anyway"); revisit at v1.0 or first enterprise ask, see `_meta/security/code-signing.md`
- Phase 5: Tauri updater wiring -- not blocked on code signing (updater keypair is separate, see `_meta/security/code-signing.md`), just unscheduled; GitHub Releases (below) now gives it a stable endpoint to point at

## Active

_None._

## Blocked

## Done

**Complete**

- **v0.1.0 released** — public Windows release published 2026-07-18 from `main` commit `12dc645`: `paste7_0.1.0_x64-setup.exe` (3.9 MB) + `.sha256`, release workflow green
- **IP/moonlighting gate cleared** — People Team confirmed 2026-07-15 that no IP-assignment, confidentiality, non-compete, or moonlighting agreement exists in Andy's employee file; publishing/demoing paste7 is unblocked
- **Phase 5 disclaimer/About surfaces** — `f0f6d74`, PR [#14](https://github.com/presspausegarage/paste7/pull/14) merged 2026-07-17; ships in v0.1.0
- **First-launch smoke test** — passed 2026-07-15 (`npm run dev`: Rust + Vite compiled, app launched and remained stable)

- Phase 4 security hardening
  - Threat model doc (`docs/threat-model.md`) -- `4ed592d`
  - Tauri capability scoping split into per-workflow grants (`core.json` / `dicom.json` / `scratchpad.json`, replacing the broad `default.json`; drops unused shell/clipboard-manager/fs plugins) -- `e699929`
  - DPAPI-encrypted settings persistence (window size, default workflow, DICOM retain sub-profiles; never message content) -- `073b97b`
  - Branded `SecretValue` TS type wired through the settings-persistence boundary and the scratchpad's live redacted-text state -- `8fd2e62`
  - In-memory invariant lint (`npm run lint:in-memory`) -- pre-existing, still green
- Phase 5 distribution (updater remains)
  - NSIS packaging polish: version 0.0.0 -> 0.1.0 across all version-bearing files, `bundle.publisher` added, `scripts/bump-version.mjs` version-sync helper
  - GitHub Releases automation: `.github/workflows/release.yml` builds on tag push, gates on typecheck/tests/lint + a tag-version consistency check, publishes SHA-256 checksums, attaches to a GitHub Release

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
