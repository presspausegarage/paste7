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

## Blocked

## Done

**Complete**

- **v0.1.0 released** -- first public release, published 2026-07-17 ET (run 29665322766): `paste7_0.1.0_x64-setup.exe` (3.7 MB) + `.sha256`, all gates green (version guard / typecheck / core tests / in-memory lint / NSIS build). Release commit `12dc645` on main. First attempt (run 29625718352, tag on `f89bbcc`) failed at tauri-build's Windows resource step: the placeholder-era `.gitignore` rule kept the whole `icons/` dir out of the repo, and the local copy masking it in dev builds was stale health-integrate "ISE" branding. Fix: new paste7 wordmark icon (lowercase "p7", accent `#3da88e` on bg `#0b0e18`, `tauri icon` set), `icon.ico` committed with a `.gitignore` exception, tag moved, validated with a full local `npm run dist` (also the first clean-compile proof for the 07-17 Dependabot cargo bumps). Andy pushed main + moved tag by hand (agent pushes classifier-blocked).
- IP/moonlighting gate cleared 2026-07-15 -- Lunit offer letter + 2025 handbook contain no such clause; People Team confirmed no confidentiality/IP-assignment/non-compete agreement exists in Andy's employee file. Publishing/demoing paste7 is unblocked.
- Phase 5: PHI disclaimer in NSIS installer license page + new app About box -- `f0f6d74`, PR [#14](https://github.com/presspausegarage/paste7/pull/14) merged 2026-07-17 (`f89bbcc`); ships in v0.1.0
- Phase 4 security hardening
  - Threat model doc (`docs/threat-model.md`) -- `4ed592d`
  - Tauri capability scoping split into per-workflow grants (`core.json` / `dicom.json` / `scratchpad.json`, replacing the broad `default.json`; drops unused shell/clipboard-manager/fs plugins) -- `e699929`
  - DPAPI-encrypted settings persistence (window size, default workflow, DICOM retain sub-profiles; never message content) -- `073b97b`
  - Branded `SecretValue` TS type wired through the settings-persistence boundary and the scratchpad's live redacted-text state -- `8fd2e62`
  - In-memory invariant lint (`npm run lint:in-memory`) -- pre-existing, still green
- Phase 5 distribution (partial)
  - NSIS packaging polish: version 0.0.0 -> 0.1.0 across all version-bearing files, `bundle.publisher` added, `scripts/bump-version.mjs` version-sync helper
  - GitHub Releases automation: `.github/workflows/release.yml` builds on tag push, gates on typecheck/tests/lint + a tag-version consistency check, publishes SHA-256 checksums, attaches to a GitHub Release

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
