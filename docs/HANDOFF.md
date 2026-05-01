# paste7 — Handoff

Handoff notes for picking this project back up.

---

## TL;DR

- **What**: Tauri 2 + React + Monaco desktop scratchpad. Three workflows: Scratchpad (paste-and-redact for HL7 v2 / v3 / CDA / FHIR), DICOM SR (file-drop SR-header redaction; SR-only after the 2026-05-01 rescope), and HL7-viewer OCR (image paste/drop → Windows.Media.Ocr → HL7 normalization → existing HL7 v2 walker; Phase 6).
- **Where**: [github.com/presspausegarage/paste7](https://github.com/presspausegarage/paste7) — public, MIT.
- **State at handoff (2026-05-01)**: Rescoped from `health-integrate`. PS360 Template Mapper + String Gen + Tool Launcher + Terminal stripped. Tauri/Vite/Monaco scaffold survives. Phase 1 engine 6/7 steps complete: API, format detector, walkers (hl7v2/json/xml), identity pool + redactor, bundled rule packs, label dictionary. `createEngine()` with no config now redacts across all five formats out of the box and emits human-labeled TokenTrees. 158 tests green. All workflow views still placeholders.
- **Next**: Phase 1 step 7 — property-based tests (fast-check fuzzing of engine.redact across all formats). After Phase 1, move to Phase 2 (Scratchpad UI).

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

- **Repo scaffolding**: npm workspaces monorepo, typecheck script, vitest in `@paste7/core`, gitignore tuned for Tauri + Vite outputs, public GitHub + MIT, clean commit history.
- **Tauri shell**: launches a 1280×800 window titled "paste7", renders the Vite frontend, no network capabilities beyond IPC.
- **Sidebar**: two groups (Paste, File), two workflow entries (Scratchpad, DICOM). Both render placeholder views.
- **Two Tauri commands**: `ping` (health check) and `read_text_file` (UTF-8 read for user-selected absolute paths).

### Phase 1 progress (engine)

| Step | Status | Commit |
|---|---|---|
| 1. Engine API surface + types | shipped | `25ab8e2` |
| 2. Format detector | shipped | `22028c8` |
| 3a. HL7 v2 walker | shipped | `5e01418` |
| 3b. FHIR JSON walker | shipped | `60539a7` |
| 3c. XML walker (hl7v3, cda, fhir-xml) | shipped | `cd6b425` |
| 4. Identity pool + redactor + engine wiring | shipped | `82cb0a6` |
| 5. Bundled rule packs (hl7v2, fhir-json, fhir-xml, cda, hl7v3) | shipped | `edf6a8f` |
| 6. Label dictionary integration | shipped | `de9652e` |
| 7. Property-based tests | next |  |

The walker contract was extended in step 3a: `Walker.redact()` now returns `{ redacted, tree, findings, parseErrors }` so the engine doesn't need a side-channel for findings/errors.

The XML walker introduces `fast-xml-parser` as the only runtime dependency in `@paste7/core`. It uses `preserveOrder=true` to keep element order across parse-and-serialize.

The redactor uses a Norse-themed pool (30 name pairs, 21 streets, 10 cities). Substitution is shape-aware: SSN-shaped input emits `000-00-NNNN`, MRN-shaped emits `MRN-FAKE-NNNN`, phone preserves dashed/dotted/parens shape against `555-01NN`, dates emit `1950-01-01` in the input's format. Bindings persist per Engine instance for cross-message consistency; FNV-1a-keyed map keeps originals out as plaintext map keys.

Rule packs default to `DEFAULT_RULE_PACKS` from `rules/index.ts`. CDA + HL7 v3 share a `SHARED_RIM_RULES` set with trailing-fragment patterns, so both formats redact under any document/interaction root.

Step 6 added human-readable labels to TokenNode. HL7 v2 labels come from the `hl7-dictionary` npm package (vendors v2.1–v2.7.1 segment + field defs); version is read from MSH-12 with a v2.5 default. FHIR + CDA labels are hand-curated against rule-pack-targeted paths plus common navigation. Walkers thread the resolved label into every node they emit; unknown paths fall back to the path itself.

158 tests across 8 files: 15 format-detect + 18 hl7v2 walker + 13 fhir-json walker + 16 xml walker + 38 redactor + 13 engine + 17 rules + 28 labels.

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
- **Code signing**: deferred 2026-05-01. Pilot ships unsigned (one-click SmartScreen warning per user). Decision revisited at v1.0 or first enterprise ask. See [`_areas/security/code-signing.md`](../../_areas/security/code-signing.md) for the alternatives table preserved for that revisit.
- **Tauri identifier changed**: `com.health-integrate.app` → `dev.paste7.app`. Pre-alpha; no installed users to migrate.
- **Tauri build needs the C++ workload**. Initial Rust build fails with `link: extra operand` errors if VS Build Tools don't include "Desktop development with C++" — that error means `link.exe` is being shadowed by coreutils `link` from Git Bash.
- **CRLF warnings** on every git operation are harmless (Windows filesystem).
- **Dependabot housekeeping done** 2026-05-01: 5 stale PRs (#3-#7) closed; `chore/dependabot` branch deleted; bot will regenerate against current main when Phase 2 actually touches the affected `packages/app/` deps.

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

### Phase 3 — DICOM SR headers workflow

Different UX paradigm (file-drop). **Scope-narrowed (2026-05-01) to Structured Report objects only**, headers only. Tool rejects non-SR DICOM on file-drop. ContentSequence (the SR tree body) is preserved verbatim — only File Meta + Patient/Study/Series/SOP module tags are redacted. Pick library: `dicom-rs` (Rust crate, Tauri command exposes redact-and-export) vs `dcmjs` (TS, runs in WebView); SR-only scope makes `dcmjs` likely sufficient.

### Phase 4 — Security hardening, Phase 5 — Distribution

Per PLAN.md.

### Phase 6 — HL7 viewer screenshot OCR

**Scope-changed (2026-05-01)** from DICOM SC pixel-data OCR to HL7-viewer-screenshot ingestion. Pipeline: image (paste/drop) → Windows.Media.Ocr → raw text → HL7 normalization (`packages/core/src/normalize/hl7v2.ts`, canonical line endings, recovered delimiters, viewer-chrome stripping, common OCR substitutions) → `engine.redact()` (which already runs walker.parse for tokenization, rule matching, and TokenTree emission) → tokenized + redacted view. No image-output workflow; deliverable is text + tree.

### Phase 7 — Local MCP server (design-only)

`@paste7/mcp` package wrapping `@paste7/core` over stdio JSON-RPC. AI agents call `redact_hl7v2`, `redact_fhir`, `redact_dicom_sr_headers`, `normalize_hl7v2`, etc. Preserves no-network. Framed as "PHI redaction primitives," not compliance-claiming language.

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

1. **Code signing path** — deferred 2026-05-01. Unsigned pilot; revisit at v1.0 or first enterprise ask. Trusted Signing was briefly chosen and reversed (cost not justifiable pre-revenue). See [`_areas/security/code-signing.md`](../../_areas/security/code-signing.md) for the preserved alternatives table.
2. **DICOM library** — `dicom-rs` (Rust, smaller bundle, more code) or `dcmjs` (TS, larger bundle, less code)?
3. **Format detection ambiguity** — auto-detect with confidence + override, or always require explicit format selection? (Current PLAN.md: auto-detect with override.)
4. **HL7 v3 messaging coverage** — only RIM paths shared with CDA, or full message-type catalog? (Current scope: shared paths only; full catalog deferred to user-driven.)
5. **Phase 6 OCR fallback** — if Windows.Media.Ocr accuracy is insufficient, ship tesseract.js WASM (~14 MB) as opt-in, or accept the gap?
6. **Phase 7 MCP** — separate `@paste7/mcp` npm package, or sub-binary within the desktop installer? (Current PLAN.md: separate package.)
