# paste7 — Handoff

Handoff notes for picking this project back up.

---

## TL;DR

- **What**: Tauri 2 + React + Monaco desktop scratchpad. Three workflows: Scratchpad (paste-and-redact for HL7 v2 / v3 / CDA / FHIR), DICOM SR (file-drop SR-header redaction; SR-only after the 2026-05-01 rescope), and HL7-viewer OCR (image paste/drop → Windows.Media.Ocr → HL7 normalization → existing HL7 v2 walker; Phase 6).
- **Where**: [github.com/presspausegarage/paste7](https://github.com/presspausegarage/paste7) — public, MIT.
- **State at handoff (2026-05-01)**: Rescoped from `health-integrate`. PS360 Template Mapper + String Gen + Tool Launcher + Terminal stripped. Tauri/Vite/Monaco scaffold survives. **Phase 1 engine complete (7/7 steps)**: API, format detector, walkers (hl7v2/json/xml), identity pool + redactor, bundled rule packs, label dictionary, property-based fuzz tests. **Phase 2 Scratchpad UI complete (6/6 steps)**: split Monaco panes, debounced engine.redact() wiring, findings side panel, raw/tree toggle, format chrome, copy guards, in-memory invariant lint. **Phase 3 DICOM SR complete (4/4 steps)**: SOP class family detection, SR header rule pack (PS 3.15 BACP subset, ~67 tags), dcmjs-backed walker with UID re-map cache, retain sub-profile gates (dates / UIDs / device-IDs), file-drop + header table + redact-and-export UI, scoped Rust write command (`write_redacted_dicom` enforces `*.redacted.dcm` destination), in-memory lint extended to `dicom/**`. 251 tests green (158 example + 34 property + 14 SOP + 4 redactor surface + 23 rule pack + 22 redactor end-to-end).
- **Next**: Tauri runtime smoke test of Phase 2 + Phase 3 (the only path that hasn't been exercised this session). Then Phase 4 — security hardening (per-workflow capability scoping, branded `SecretValue` types, DPAPI for settings).

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
        scratchpad/         Paste view (Phase 2 — split Monaco, findings, tree, copy guards)
        dicom/              File-drop view (Phase 3 — drop area, header table, redact-and-export, retain toggles)
        shared/             Sidebar, Monaco, workflows registry, fs wrappers
      src-tauri/          Tauri 2 Rust shell
        src/
          lib.rs          Tauri commands: ping, read_text_file, read_dicom_file, write_redacted_dicom
          ocr.rs          (Phase 6) Windows.Media.Ocr binding
  scripts/
    lint-in-memory.mjs    (Phase 2/3) grep-based disk-write guard for scratchpad/** + dicom/**
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
- **Sidebar**: two groups (Paste, File), two workflow entries (Scratchpad, DICOM). Both live.
- **Scratchpad** (Phase 2): top Monaco pane for paste-in, bottom pane toggles between read-only Monaco (raw redacted text) and a recursive token-tree view; right-side findings panel with category filter chips; header toolbar with format dropdown (auto + 5 overrides), confidence badge, and a copy-redacted/copy-original split-button; persistent "PHI mode: ON" status badge. Engine instance is per-view (one session of identity-binding state); input is debounced at 250ms before each `engine.redact()` call. No disk-write call paths in scratchpad/** — enforced by `npm run lint`.
- **DICOM SR** (Phase 3): drop-zone (Tauri-native drag-drop via `webview.onDragDropEvent`) plus open-dialog fallback; once a file is loaded, the body shows a summary card (source filename, SOP Class name + UID, redaction count, last-export path), three retain-profile toggles (dates / UIDs / device IDs), and a findings table (tag, VR, name, strategy + category badges, replacement value); export button writes `<original>.redacted.dcm` next to the source via the scoped `write_redacted_dicom` Rust command. SR-only validation runs on every load — non-SR DICOM (CT/CR/MR/etc.) is rejected before any redaction. ContentSequence (0040,A730) and AcquisitionContext (0040,0555) are preserved verbatim. UID re-mapping uses dcmjs's `DicomMetaDictionary.uid()` (`2.25.<random>`); the same input UID maps to the same fake across all tags within a session, including across successive files.
- **Four Tauri commands**: `ping` (health check), `read_text_file` (UTF-8 read), `read_dicom_file` (binary read with `.dcm` extension guard), `write_redacted_dicom` (writes `<originalPath>.redacted.dcm` only — destination derived in Rust, not user-supplied).

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
| 7. Property-based tests | shipped | `8a75351` |

The walker contract was extended in step 3a: `Walker.redact()` now returns `{ redacted, tree, findings, parseErrors }` so the engine doesn't need a side-channel for findings/errors.

The XML walker introduces `fast-xml-parser` as the only runtime dependency in `@paste7/core`. It uses `preserveOrder=true` to keep element order across parse-and-serialize.

The redactor uses a Norse-themed pool (30 name pairs, 21 streets, 10 cities). Substitution is shape-aware: SSN-shaped input emits `000-00-NNNN`, MRN-shaped emits `MRN-FAKE-NNNN`, phone preserves dashed/dotted/parens shape against `555-01NN`, dates emit `1950-01-01` in the input's format. Bindings persist per Engine instance for cross-message consistency; FNV-1a-keyed map keeps originals out as plaintext map keys.

Rule packs default to `DEFAULT_RULE_PACKS` from `rules/index.ts`. CDA + HL7 v3 share a `SHARED_RIM_RULES` set with trailing-fragment patterns, so both formats redact under any document/interaction root.

Step 6 added human-readable labels to TokenNode. HL7 v2 labels come from the `hl7-dictionary` npm package (vendors v2.1–v2.7.1 segment + field defs); version is read from MSH-12 with a v2.5 default. FHIR + CDA labels are hand-curated against rule-pack-targeted paths plus common navigation. Walkers thread the resolved label into every node they emit; unknown paths fall back to the path itself.

192 tests across 9 files: 15 format-detect + 18 hl7v2 walker + 13 fhir-json walker + 16 xml walker + 38 redactor + 13 engine + 17 rules + 28 labels + 34 property-based (fast-check).

### Phase 2 progress (Scratchpad UI)

| Step | Status | Commit |
|---|---|---|
| 1. Wire scratchpad shell — split Monaco panes + debounced engine.redact() + status bar | shipped | `1ff6241` |
| 2. Findings side panel with category filter chips | shipped | `fdfe99f` |
| 3. Tokenized tree view with raw/tree toggle | shipped | `082eed1` |
| 4. Format-detection chrome (auto + 5 overrides + confidence) | shipped | `e8d2cc0` |
| 5. Copy guards (redacted-primary split-button, original explicit) | shipped | `b3d6ab4` |
| 6. In-memory invariant lint (`scripts/lint-in-memory.mjs`) | shipped | `a1a679d` |

Pre-step `1c9f917` (core): added a triple-slash reference to `labels/hl7-dictionary.d.ts` so app-side tsc resolves the ambient module declaration when it walks core's sources. Required because `@paste7/core` exports source paths directly (`main: "./src/index.ts"`) and the app's tsconfig only includes `packages/app/src/**/*`, so ambient declarations under `packages/core/src/labels/` were not in the compilation unit until the triple-slash forced inclusion.

Engine lifecycle in the Scratchpad: one `Engine` instance per `ScratchpadView` mount, retained via `useState(() => createEngine())`. This means identity bindings (real → fake) accumulate across edits within a single session, giving cross-edit consistency for the same patient who appears in successive paste edits. To start fresh with a new identity pool, the user has to navigate away and back — a Clear button is a possible Phase 2 polish task.

`navigator.clipboard.writeText` (browser API) is used for both copy actions — no Tauri clipboard plugin needed because the writes happen in response to user button clicks, which satisfies the browser's user-activation requirement. The `clipboard-manager:default` capability already in `default.json` would only be needed for clipboard *reads* (e.g., paste-from-clipboard hotkey), which we don't have yet.

The in-memory lint flags any reference to `writeTextFile`, `writeFile`, `writeBinaryFile`, `localStorage`, `sessionStorage`, `indexedDB`, or `@tauri-apps/plugin-fs` from anywhere under `scratchpad/**`. Phase 6 will extend the same lint to `ocr/**`. `dicom/**` will need a different rule (writes are allowed, but only against `*.redacted.dcm`) — defer that until Phase 3.

The property suite generates synthetic HL7 v2 / FHIR JSON / CDA / FHIR XML messages, places marker tokens in PHI-bearing positions, and asserts six classes of invariant per format: engine.redact never throws, the redacted output re-parses without errors, no marker survives in `result.redacted`, no marker survives in `finding.redactedValue`, redact is deterministic within an engine instance, `reset()` returns to the initial state, and re-redacting the redacted output is a fixed point. Plus walker round-trip stability tests per format. The suite caught one real walker bug during authoring: fast-xml-parser's default `parseTagValue: true` was coercing element text like `<postalCode>00001</postalCode>` to the number `1`, losing leading zeros and breaking the redactor's shape-driven category branch (5-digit zip became "city"). Fixed by setting `parseTagValue: false` in `walkers/xml.ts`.

### What's placeholder

- `dicom/DicomView.tsx` — copy describing intent (Phase 3 turns it on)

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

### Phase 1 — PHI rule-pack engine ✅ shipped

All seven steps shipped (see commit table above). 192 tests cover the engine contract from end-to-end fixtures down to fast-check property invariants. No real PHI in the repo, ever — synthetic fixtures only.

### Phase 2 — Scratchpad view ✅ shipped

All six steps shipped (see Phase 2 commit table). Engine wired, split Monaco panes, findings panel with filters, tokenized tree, format chrome, copy guards, in-memory lint. Runtime UI not yet exercised in Tauri dev — typecheck + lint + core tests are green; first launch verification is the next-action smoke test. See **Phase 2 polish backlog** below for items the rough-order spec scoped down.

### Phase 3 — DICOM SR ✅ shipped

#### Phase 3 progress (DICOM SR)

| Step | Status | Commit |
|---|---|---|
| 0a. SOP class family detection (`isSrSopClass`, `getSrSopClassName`) | shipped | `f78c113` |
| 0b. DICOM types + stub factory | shipped | `0307dae` |
| 1. SR header rule pack (PS 3.15 BACP subset, ~67 tags, retain-profile gates) | shipped | `a4f4b39` |
| 2. dcmjs-backed walker (parse, walk, redact, re-serialize, UID re-map cache) | shipped | `bff0a71` |
| 3. DicomView UI + Tauri commands (`read_dicom_file`, `write_redacted_dicom`) | shipped | `678060d` |
| 4. In-memory lint extended to `dicom/**` | shipped | `0f8b6cd` |

#### dcmjs integration notes

`@paste7/core` now depends on `dcmjs` 0.50.x. dcmjs ships no types — paste7 bundles a narrow ambient declaration at `packages/core/src/dicom/dcmjs.d.ts` covering only the surface we touch (`DicomMessage.readFile`, `DicomDict.{dict,meta,write}`, `DicomMetaDictionary.{uid, punctuateTag, unpunctuateTag, dictionary, sopClassNamesByUID}`). The declaration uses a triple-slash reference at the top of `redactor.ts` so app-side tsc picks it up when walking core sources transitively (same pattern as `hl7-dictionary.d.ts` from Phase 1).

Bundle impact: ~1.1 MB unminified added to the Vite output (270 KB gzipped). dcmjs ships a packed DICOM dictionary that's most of that bulk. Tree-shaking opportunities exist (the `sr`, `derivations`, `normalizers` subtrees are unused) but are deferred to Phase 5 distribution polish.

#### Engine API: parallel surfaces

The original `Engine.redact(string)` contract stays string-only and unchanged. DICOM gets a parallel surface, `createDicomRedactor()`, returning `{ redactSrHeaders(Uint8Array): Promise<DicomRedactResult>, reset(): void }`. Both consume the same redaction primitives (`createRedactor()`, `IdentityPool`) but have separate session state — a clear in scratchpad doesn't reset DICOM bindings and vice versa. Phase 7 MCP exposes them as separate tool entries (`redact_hl7v2(string)` vs `redact_dicom_sr_headers(path)`); the parallel-surface design fits that intent natively.

#### Trust boundary for the export path

Three layers protect against accidental writes to the wrong file:

1. **JS layer**: `writeRedactedDicom(originalPath, bytes)` is the only call site that issues a write. It accepts only the source path and the bytes; no destination control.
2. **Rust layer (`write_redacted_dicom` in `lib.rs`)**: validates `original_path` is absolute and ends with `.dcm`, derives the destination as `<stem>.redacted.dcm` in the same directory, double-checks the derived destination ends with `.redacted.dcm`, then writes.
3. **Lint layer (`scripts/lint-in-memory.mjs`)**: `dicom/**` is forbidden from importing `@tauri-apps/plugin-fs` or calling `writeFile`/`writeTextFile`/`writeBinaryFile`/`localStorage`/etc. directly. The scoped `invoke("write_redacted_dicom", ...)` doesn't match any forbidden pattern by design.

Net: the only way for the UI to produce a disk artifact in `dicom/**` is via the Rust command, which can only write to a `.redacted.dcm` path adjacent to the source.

#### What's still placeholder in DICOM

The findings table currently lists **only redacted tags**. K-action tags (PatientSex, PatientAge, Modality, SOPClassUID, etc.) are preserved but invisible in the table. PLAN.md spec wanted "Header table: tag, VR, original value, redacted value... Sort/filter by tag or PHI status." A K-tag inventory + sortable/filterable table is the natural Phase 3.5 polish — the walker already has the parsed dataset; it just needs a second emitter alongside the findings list.

Bulk mode (drop a folder, redact all SR files in one pass with a skip-summary) is also deferred — single-file flow first, bulk after smoke-testing.

#### Phase 2 polish backlog (deferred from initial 6-step rough order)

- **Click-finding-to-jump**: PLAN.md calls for clicking a finding to highlight the location in both editors. Findings carry walker-format-specific paths (e.g. `PID-5.1`, `Patient.name[0]`) that don't map directly to Monaco character offsets — needs a per-walker path-to-range resolver. Reasonable Phase 2.5 task.
- **Clear / new-session button**: per-session identity bindings persist for the lifetime of `ScratchpadView`. A "Clear" action that calls `engine.reset()` and empties the input would give users an explicit way to drop state without remounting.
- **Paste-from-clipboard hotkey**: pulls clipboard text into the paste pane via the `clipboard-manager:read` capability (not currently in `default.json`). Mostly a UX accelerator.
- **Pane-layout user setting**: PLAN.md mentions "Side-by-side or stacked layout (user setting)." Currently stacked-only; switching would cost ~20 lines of CSS + a toggle.
- **Findings rule/path filters**: panel currently filters by category only. Rule and path filters land in the same code path as category chips; trivial extension.

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
| Run core tests | `npm test --workspace=@paste7/core` |
| Typecheck everything | `npm run typecheck` |
| In-memory invariant lint | `npm run lint` |
| Launch dev app | `npm run dev` |
| Build NSIS installer | `npm run dist` |
| Core engine source | `packages/core/src/` |
| Scratchpad UI | `packages/app/src/scratchpad/` |
| DICOM UI | `packages/app/src/dicom/` |
| Tauri commands | `packages/app/src-tauri/src/lib.rs` (ping, read_text_file, read_dicom_file, write_redacted_dicom) |
| Tauri config | `packages/app/src-tauri/tauri.conf.json` |
| Monaco setup | `packages/app/src/shared/monaco.ts` |
| Workflow registry | `packages/app/src/shared/workflows.ts` |
| In-memory lint script | `scripts/lint-in-memory.mjs` |

---

## Open questions

1. **Code signing path** — deferred 2026-05-01. Unsigned pilot; revisit at v1.0 or first enterprise ask. Trusted Signing was briefly chosen and reversed (cost not justifiable pre-revenue). See [`_areas/security/code-signing.md`](../../_areas/security/code-signing.md) for the preserved alternatives table.
2. **DICOM library** — `dcmjs` (TS, in-WebView) chosen 2026-05-01 in Phase 3. SR-only scope made the in-WebView path the right fit; avoids extending the Tauri command surface to wrap DICOM parse/serialize.
3. **Format detection ambiguity** — auto-detect with confidence + override (decided 2026-05-01 in Phase 2; toolbar shows detected format + confidence pct in auto mode, "forced" badge when overridden).
4. **HL7 v3 messaging coverage** — only RIM paths shared with CDA, or full message-type catalog? (Current scope: shared paths only; full catalog deferred to user-driven.)
5. **Phase 6 OCR fallback** — if Windows.Media.Ocr accuracy is insufficient, ship tesseract.js WASM (~14 MB) as opt-in, or accept the gap?
6. **Phase 7 MCP** — separate `@paste7/mcp` npm package, or sub-binary within the desktop installer? (Current PLAN.md: separate package.)
