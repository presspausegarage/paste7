# paste7 — Handoff

Handoff notes for picking this project back up.

---

## TL;DR

- **What**: Tauri 2 + React + Monaco desktop scratchpad. Two workflows: Scratchpad (paste-and-redact for HL7 v2 / v3 / CDA / FHIR) and DICOM (file-drop header redaction; UI-screenshot pixel-data in Phase 6).
- **Where**: [github.com/presspausegarage/paste7](https://github.com/presspausegarage/paste7) — public, MIT.
- **State at handoff (2026-04-30)**: Rescoped from `health-integrate`. PS360 Template Mapper + String Gen + Tool Launcher + Terminal stripped. Tauri/Vite/Monaco scaffold survives. PHI engine and both workflow views are placeholders; no functional code yet.
- **Next**: Phase 1 — design + scaffold the PHI rule-pack engine in `@paste7/core`.

---

## Decision log (rescope, 2026-04-30)

- **Renamed** product from "Health Integrate" to "paste7". GitHub repo renamed via `gh repo rename paste7`. Old URL redirects indefinitely.
- **Stripped** (sunk cost recognized): PS360 Template Mapper (entire), String Generator (placeholder), Tool Launcher (placeholder), Integrated Terminal (placeholder). Original target audience too narrow; B2B sales cycle incompatible with solo Year-1 plan.
- **Architecture preserved**: TypeScript core with Rust Tauri shell. Editor-latency rationale unchanged (live diagnostics, hover, completion run on every keypress and benefit from zero IPC).
- **Format scope**: HL7 v2 + HL7 v3 + C-CDA + FHIR (JSON + XML) via paste UX; DICOM via file-drop UX. Five paste formats unified by three walkers (hl7v2, xml, json) and four rule packs.
- **Phase 6 added**: pixel-data OCR redaction scope-limited to DICOM SC clean UI screenshots. Uses Windows.Media.Ocr for zero-bundle-cost offline OCR. Diagnostic imaging burned-in text remains out of scope.
- **Phase 7 added (design-only)**: local MCP server wrapping `@paste7/core` for AI-agent consumption. stdio transport preserves no-network. Framed as "PHI redaction primitives" not "HIPAA-compliant" (compliance is operational, not code-level).
- **Explicit non-goals**: DICOM diagnostic imaging pixel redaction, SCP listener, Azure connectivity, X12, NCPDP, free-text clinical narrative scrubbing.
- **Trademark consideration**: product name "paste7" intentionally avoids phonetic of registered marks. Disclaimer in README and About box.

---

## Architecture at a glance

```
paste7/
  packages/
    core/                 PHI rule-pack engine (TS only, no UI, no Tauri deps)
      src/
        index.ts          (stub, pre-Phase-1)
        engine.ts         (Phase 1)
        format-detect.ts  (Phase 1)
        walkers/          (Phase 1) hl7v2, xml, json
        rules/            (Phase 1) hl7v2, hl7v3, cda, fhir
        redact.ts         (Phase 1)
        identities.ts     (Phase 1)
    app/
      src/
        scratchpad/         Paste view (placeholder; real impl Phase 2)
        dicom/              File-drop view (placeholder; headers Phase 3, pixel-data Phase 6)
        shared/             Sidebar, Monaco, workflows registry, fs wrappers
      src-tauri/          Tauri 2 Rust shell
        src/
          lib.rs          Tauri commands: ping, read_text_file
          ocr.rs          (Phase 6) Windows.Media.Ocr binding
  docs/
    HANDOFF.md            this file
    phi-field-map.md      (Phase 1 deliverable; not yet written)
    threat-model.md       (Phase 4 deliverable; not yet written)
  PLAN.md                 phased plan, architecture, non-goals
  README.md               public landing
  CLAUDE.md               AI-assistant bootstrap
  NOTICES.md              third-party attributions
  LICENSE                 MIT
```

The engine in `@paste7/core` is UI-agnostic by design. Tauri desktop is one consumer; a future MCP server (Phase 7) is another.

---

## Current state

### What works end-to-end

- **Repo scaffolding**: npm workspaces monorepo, typecheck script (no tests yet — Phase 1 brings them back), gitignore tuned for Tauri + Vite outputs, public GitHub + MIT, clean commit history.
- **Tauri shell**: launches a 1280×800 window titled "paste7", renders the Vite frontend, no network capabilities beyond IPC.
- **Sidebar**: two groups (Paste, File), two workflow entries (Scratchpad, DICOM). Both render placeholder views.
- **Two Tauri commands**: `ping` (health check) and `read_text_file` (UTF-8 read for user-selected absolute paths).

### What's placeholder

- `scratchpad/ScratchpadView.tsx` — copy describing intent
- `dicom/DicomView.tsx` — copy describing intent
- `core/src/index.ts` — empty export, comments listing planned modules

### What's stripped (was in `health-integrate`)

- All PS360 Template Mapper code: `packages/app/src/ps360/`, `packages/core/src/{linter,parsers/{datavalue,portal-autotext},serializers/portal-autotext,types/{datavalue,portal-autotext}}.ts`
- All PS360 tests and fixtures: `packages/core/test/`
- String Generator placeholder: `packages/app/src/string-gen/`
- Tool Launcher placeholder: `packages/app/src/tools/`
- Terminal placeholder: `packages/app/src/terminal/`
- HL7 placeholder (replaced by `scratchpad/`): `packages/app/src/hl7/`
- `tombstone.md` from the brief archive interlude

---

## Known issues / caveats

- **Lockfiles need regeneration.** `package-lock.json` and `Cargo.lock` still reference `@health-integrate/*` package names. First `npm install` and `cargo build` after this rescope will reconcile against the new `@paste7/*` names.
- **Code signing not set up.** Unsigned NSIS installer works on unmanaged Windows (one-time SmartScreen click). SignPath Foundation eligibility threshold needs re-checking — repo just renamed (preserves history), but reputation signals (stars, age, activity) reset effectively to day-one. Fallbacks: Certum OSS (~$30/yr), SSL.com eSigner EV (~$349/yr), or unsigned pilot.
- **Tauri identifier changed**: `com.health-integrate.app` → `dev.paste7.app`. Pre-alpha; no installed users to migrate.
- **Tauri build needs the C++ workload**. Initial Rust build fails with `link: extra operand` errors if VS Build Tools don't include "Desktop development with C++" — that error means `link.exe` is being shadowed by coreutils `link` from Git Bash.
- **CRLF warnings** on every git operation are harmless (Windows filesystem).
- **Open dependabot PR** on the old branch `chore/dependabot` — still alive after the repo rename. Review/close separately when convenient.

---

## How to continue

### Phase 1 — PHI rule-pack engine (recommended next 1-2 weeks)

1. **Design the engine contract first.** Sketch `engine.ts` API, walker interface, rule-pack format. Property-based test framework before rules.
2. **Write `docs/phi-field-map.md`.** All four paste formats. HIPAA Safe Harbor 18 identifiers map to:
   - HL7 v2: PID/NK1/GT1/IN1/IN2/OBX/NTE/DG1/PR1/MSH-4,6 paths
   - HL7 v3 + CDA: `recordTarget`, `author/assignedAuthor`, `custodian`, `participant`, `componentOf`
   - FHIR: Patient, Practitioner, RelatedPerson, Person resources + identifier traversal across all resource types
3. **Implement walkers** before rule packs. The three walkers are the contract; rule packs plug into stable interfaces.
4. **Implement rule packs** in dependency order: hl7v2 (most familiar), then fhir (most modern + structurally simplest JSON), then cda (XML walker validation), then hl7v3 (largely shares CDA paths).
5. **Tests**: synthetic fixtures only. No real PHI in the repo, ever.

### Phase 2 — Scratchpad view (recommended after Phase 1 ships)

Wire the engine into the Monaco-based paste view. Side-by-side or stacked layout. Findings panel. Format auto-detect with override.

### Phase 3 — DICOM headers workflow

Different UX paradigm (file-drop). Pick library: `dicom-rs` (Rust crate, Tauri command exposes redact-and-export) vs `dcmjs` (TS, runs in WebView). Pixel-data PHI deferred to Phase 6.

### Phase 4 — Security hardening, Phase 5 — Distribution

Per PLAN.md.

### Phase 6 — Pixel-data redaction (UI screenshots only)

Windows.Media.Ocr via `windows` Rust crate. Zero bundle cost. Scope-limited to clean SC application screenshots; diagnostic imaging burned-in text remains out of scope.

### Phase 7 — Local MCP server (design-only)

`@paste7/mcp` package wrapping `@paste7/core` over stdio JSON-RPC. AI agents call `redact_hl7v2`, `redact_fhir`, `redact_dicom_headers`, etc. Preserves no-network. Framed as "PHI redaction primitives," not compliance-claiming language.

---

## Repo cheatsheet

| Task | Command / file |
|---|---|
| Run core tests (none yet) | `npm test --workspace=@paste7/core` |
| Typecheck everything | `npm run typecheck` |
| Launch dev app | `npm run dev` |
| Build NSIS installer | `npm run dist` |
| Core engine source | `packages/core/src/` |
| Scratchpad UI | `packages/app/src/scratchpad/` |
| DICOM UI | `packages/app/src/dicom/` |
| Tauri commands | `packages/app/src-tauri/src/lib.rs` |
| Tauri config | `packages/app/src-tauri/tauri.conf.json` |
| Monaco setup | `packages/app/src/shared/monaco.ts` |
| Workflow registry | `packages/app/src/shared/workflows.ts` |

---

## Open questions

1. **Code signing path** — re-attempt SignPath Foundation, or commit to Certum OSS, or ship unsigned pilot first?
2. **DICOM library** — `dicom-rs` (Rust, smaller bundle, more code) or `dcmjs` (TS, larger bundle, less code)?
3. **Format detection ambiguity** — auto-detect with confidence + override, or always require explicit format selection? (Current PLAN.md: auto-detect with override.)
4. **HL7 v3 messaging coverage** — only RIM paths shared with CDA, or full message-type catalog? (Current scope: shared paths only; full catalog deferred to user-driven.)
5. **Phase 6 OCR fallback** — if Windows.Media.Ocr accuracy is insufficient, ship tesseract.js WASM (~14 MB) as opt-in, or accept the gap?
6. **Phase 7 MCP** — separate `@paste7/mcp` npm package, or sub-binary within the desktop installer? (Current PLAN.md: separate package.)
