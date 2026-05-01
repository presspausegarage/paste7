# paste7 — Claude bootstrap

**If you are an AI assistant starting a new session on this project, read this file first, then [docs/HANDOFF.md](docs/HANDOFF.md), then [PLAN.md](PLAN.md).**

---

## One-paragraph context

paste7 is a Tauri 2 + React + Monaco desktop scratchpad for safe inspection of healthcare interop messages. Two workflows: a **Scratchpad** for paste-and-observe (HL7 v2, HL7 v3, C-CDA, FHIR JSON/XML) and a **DICOM** view for file-drop header inspection. PHI auto-redacted via per-format rule packs. Per-user Windows installer, no admin rights, no network capabilities, in-memory only. Public MIT on GitHub at `presspausegarage/paste7`. Rescoped 2026-04-30 from a previous radiology informatics toolkit (`health-integrate` → `paste7`); Tauri/Vite/Monaco scaffold survived, the rest was stripped.

## Resume ritual

```bash
cd C:/dev/apps/paste7
npm test --workspace=@paste7/core   # core engine tests (none yet)
npm run dev                         # launch Tauri dev app
```

Then read `docs/HANDOFF.md` for current build state.

## Working conventions

- **MIT license, public GitHub**. No vendor branding. No Claude attribution in commits or code comments.
- **Git commits direct** (no Claude footer). Author via `-c user.name="Andy Weston" -c user.email="andywestongaming@gmail.com"`.
- **Save-as, never overwrite.** DICOM redact-and-export writes `<original>.redacted.dcm`; never mutates source files.
- **Never write paste content to disk.** Scratchpad is memory-only by design — enforced by CI lint.
- **CRLF warnings on git operations are harmless** (Windows filesystem).
- **No HL7/FHIR trademark phrasing in product framing.** "Compatible with HL7 v2" or "parses FHIR" is descriptive use (allowed). Branding around the marks is not.

## Fast orientation by task

| Task | Primary file(s) |
|---|---|
| Add or refine a PHI rule | `packages/core/src/rules/{hl7v2,hl7v3,cda,fhir}.ts` |
| Add a format walker | `packages/core/src/walkers/{hl7v2,xml,json}.ts` |
| Tweak format detection | `packages/core/src/format-detect.ts` |
| Scratchpad UI change | `packages/app/src/scratchpad/` |
| DICOM UI change | `packages/app/src/dicom/` |
| Add a Tauri command | `packages/app/src-tauri/src/lib.rs` |
| Tauri config (window, bundle, CSP) | `packages/app/src-tauri/tauri.conf.json` |
| Monaco setup / new language grammar | `packages/app/src/shared/monaco.ts` |
| New workflow view | `packages/app/src/<workflow>/` + register in `shared/workflows.ts` + wire in `App.tsx` |

## Prerequisites

- Node 20+
- rustup (cargo on PATH)
- Visual Studio Build Tools with **Desktop development with C++** workload
- WebView2 (preinstalled on Win10 21H2+/Win11)

## What not to do

- **Don't rescaffold the Tauri shell.** It is the only thing that survived the 2026-04-30 rescope and is working.
- **Don't reintroduce stripped scope.** PS360 Template Mapper, String Generator, Tool Launcher, Terminal are gone. Don't restore them.
- **Don't add network capabilities.** No SCP listener, no Azure connectivity, no telemetry, no update-server pings beyond Tauri's signed-release fetch. The "no network" threat model is load-bearing for the secure-environment positioning.
- **Don't claim DICOM pixel-data redaction.** Headers only.
- **Don't add vendor or AI-assistant branding** to UI, docs, or commits.
- **Don't revisit "TS core vs Rust core" or "Tauri vs Electron / VS Code extension"** without reading HANDOFF rationale; both were debated and decided.

---

For anything not covered here: **`docs/HANDOFF.md`** has the detailed current state, decisions, and next-action priorities.
