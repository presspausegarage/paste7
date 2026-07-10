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
- Phase 4: code signing -- explicitly deferred (unsigned pilot ships with SmartScreen "More info -> Run anyway"); revisit at v1.0 or first enterprise ask, see `_areas/security/code-signing.md`
- Phase 5: distribution (per-user NSIS installer, GitHub Releases, Tauri updater)

## Active

## Blocked

## Done

**Complete**

- Phase 4 security hardening
  - Threat model doc (`docs/threat-model.md`) -- `4ed592d`
  - Tauri capability scoping split into per-workflow grants (`core.json` / `dicom.json` / `scratchpad.json`, replacing the broad `default.json`; drops unused shell/clipboard-manager/fs plugins) -- `e699929`
  - DPAPI-encrypted settings persistence (window size, default workflow, DICOM retain sub-profiles; never message content) -- `073b97b`
  - Branded `SecretValue` TS type wired through the settings-persistence boundary and the scratchpad's live redacted-text state -- `8fd2e62`
  - In-memory invariant lint (`npm run lint:in-memory`) -- pre-existing, still green

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
