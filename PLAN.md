# paste7 — Plan

A lightweight desktop scratchpad for inspecting healthcare interop messages with PHI auto-redaction. Per-user Windows installer, no admin rights, no network capabilities, in-memory only.

**Formats (paste UX)**: HL7 v2, HL7 v3 messaging, C-CDA, FHIR (JSON + XML).
**Formats (file-drop UX)**: DICOM SR headers (Phase 3).
**Formats (image-input UX)**: screenshots of HL7 v2 messages displayed in third-party viewers — OCR + HL7 normalization → existing HL7 v2 walker (Phase 6).

This file replaces a previous plan that scoped a multi-workflow radiology informatics toolkit (PS360 Template Mapper, String Generator, Tool Launcher, Integrated Terminal). All of that is removed; the residual Tauri/Vite/Monaco scaffold survives as the shell.

## Architecture

```
paste7/
  packages/
    core/                 PHI rule-pack engine (TS, no UI, no Tauri deps)
      src/
        engine.ts         (Phase 1) orchestrator
        format-detect.ts  (Phase 1) heuristic format detector
        walkers/          (Phase 1) hl7v2, xml, json
        rules/            (Phase 1) hl7v2, hl7v3, cda, fhir
        redact.ts         (Phase 1) fake-identity substitution
        identities.ts     (Phase 1) fake-identity pool
        normalize/        (Phase 6) hl7v2 OCR-text normalization (text-in/text-out)
    app/
      src/
        scratchpad/         Paste view (Phase 2)
        dicom/              DICOM SR file-drop view (Phase 3)
        ocr/                HL7-viewer-screenshot ingest (Phase 6)
        shared/             Sidebar, Monaco, workflow registry — preserved
      src-tauri/          Tauri 2 Rust shell — preserved
        src/
          ocr.rs          (Phase 6) Windows.Media.Ocr binding
  docs/
    phi-field-map.md      (Phase 1 deliverable) per-format PHI paths
    threat-model.md       (Phase 4 deliverable) capability scoping, in-memory invariants
  PLAN.md                 (this file)
  README.md
  CLAUDE.md
  NOTICES.md
  LICENSE
```

The engine in `@paste7/core` is intentionally UI-agnostic. Same package powers the Tauri desktop UI today and (Phase 7) a local MCP server tomorrow.

## Phase 1 — PHI rule-pack engine (`@paste7/core`)

Build the engine before any UI work. Three walkers cover all five paste formats; rule packs decouple format-specific PHI knowledge from generic traversal.

- **`engine.ts`**: detect format, pick walker, apply rule pack, return redacted result + findings.
- **`format-detect.ts`**: heuristic detector. Pipe-delimited starting with `MSH|` → HL7 v2. XML root `<ClinicalDocument>` → C-CDA. XML root with `urn:hl7-org:v3` namespace → HL7 v3. XML or JSON with `resourceType` → FHIR. Returns format + confidence.
- **`walkers/hl7v2.ts`**: tokenize segment-field-component-subcomponent grid; emit field-path → text.
- **`walkers/xml.ts`**: streaming or DOM walk over XML; emit element-path → text. Covers HL7 v3, C-CDA, FHIR XML.
- **`walkers/json.ts`**: recursive JSON walk; emit path → value. Covers FHIR JSON.
- **`rules/{hl7v2,hl7v3,cda,fhir}.ts`**: each is a rule pack listing PHI paths and per-path redaction strategy (substitute, scrub, flag-only).
- **`redact.ts`**: deterministic-per-session substitution — same input → same fake output within the session for cross-message consistency.
- **`identities.ts`**: themed obvious-fake identity pool. Numeric PHI uses obvious-fake patterns: `MRN-FAKE-0042`, `000-00-0001`, `555-0100`, dates 1950-2000.

**PHI field map** documented in `docs/phi-field-map.md` covering all four paste formats. Anchor: HIPAA Safe Harbor 18 identifiers.

**Tests** (vitest + fast-check): rule pack coverage on synthetic fixtures, deterministic redaction within a session, walker round-trip integrity, format detector confidence calibration.

## Phase 2 — Scratchpad view

- **Paste area** (Monaco): top pane. Plain text input or paste from clipboard.
- **Format indicator**: detected format with override dropdown (HL7 v2, HL7 v3, CDA, FHIR JSON, FHIR XML, auto).
- **Redacted view** (Monaco, read-only): bottom pane. Side-by-side or stacked layout (user setting).
- **Findings panel**: PHI flags, structural issues, free-text PHI matches. Click a finding to jump to the location in both editors.
- **Status bar**: "PHI mode: ON" — always visible, non-toggleable.
- **Guards**:
  - Save action exports redacted only. Original has no save path.
  - Copy prompt: "Copy original or redacted?" (default: redacted).
  - In-memory only. Closing the app discards all paste content. No autosave, no recent-files, no history.
- **CI lint rule**: any `writeTextFile` call from `packages/app/src/scratchpad/**` fails CI.

## Phase 3 — DICOM SR headers workflow

Different UX paradigm (file-drop, not paste). Separate workflow tab. **Scope-narrowed (2026-05-01) to DICOM Structured Report objects only**, headers only — no other modalities, no SR content tree, no pixel data ever.

- **Drop area**: accepts `.dcm` files. Validates SOP Class UID is in the SR family (`1.2.840.10008.5.1.4.1.1.88.*`); rejects non-SR objects with a clear error.
- **Header table**: tag (Group,Element), VR, original value, redacted value. Sort/filter by tag or PHI status. Restricted to File Meta + Patient/Study/Series/SOP modules; ContentSequence (the SR tree) is preserved verbatim — out of redaction scope.
- **Redact-and-export**: writes sanitized `.dcm` next to original as `<name>.redacted.dcm`. Never overwrites source.
- **Bulk mode**: drop a folder; SR-filter then redact all in one pass; report summary including a count of skipped non-SR files.
- **No pixel-data redaction**: explicit non-goal in v1. SR objects can carry pixel data (waveforms, ECG strips) but redacting non-text content is out of scope.
- **Library**: `dicom-rs` (Rust side, exposed via Tauri command) or `dcmjs` (TS side). With SR-only scope the surface is small enough that `dcmjs` is likely sufficient; revisit during phase.
- **Rule pack**: subset of DICOM PS 3.15 Basic Application Confidentiality Profile filtered to tags actually present in SR header modules (~80 tags vs ~250 generic). Optional sub-profiles (retain-dates, retain-UIDs, retain-device-IDs) as user-configurable settings.

## Phase 4 — Security hardening

- **Tauri 2 capability scoping per workflow**:
  - Scratchpad: clipboard read/write only. No file I/O. No network.
  - DICOM SR: dialog open + sanitized file write only. No clipboard access. No network.
  - OCR (Phase 6): clipboard image read OR file-drop image read; no file write. No network.
  - All: shared deny-list — no shell, no terminal, no http, no environment access.
- **DPAPI for persistent state**: settings only (window size, default workflow, DICOM sub-profile selection). Never message content.
- **Code signing**: deferred. Pilot ships unsigned; users see a one-time SmartScreen "More info → Run anyway" on first install. Reputation accumulation only starts the day a release is signed, so deferring doesn't compound — it just delays. Decision revisited at v1.0 or first enterprise ask, whichever comes first. See [`_areas/security/code-signing.md`](../../_areas/security/code-signing.md) for the alternatives table preserved for that revisit.
- **In-memory invariant lint**: scratchpad code path is checked by CI for any disk-writing call.
- **Branded `SecretValue` types**: any redacted/original message text wears a TS-level type that lacks `toJSON`, making accidental persistence a compile error.

## Phase 5 — Distribution

- Per-user NSIS installer (already configured at `tauri.conf.json: installMode = "currentUser"`).
- GitHub Releases via `npm run dist`.
- Tauri built-in updater fetching signed releases.
- README PHI disclaimer prominent in installer screen and app About box.

## Phase 6 — HL7 viewer screenshot OCR

**Scope-changed (2026-05-01)** from DICOM SC pixel-data OCR to HL7-viewer-screenshot ingestion. The new target is screenshots of HL7 v2 messages displayed in third-party viewer/integration tools, where copy-paste isn't available and the only artifact a user can extract is an image.

The OCR output feeds the existing Phase 1 HL7 v2 walker — no new redaction surface, no image-output workflow, no pixel-data manipulation.

### Pipeline

```
image (paste / drop)
  → Windows.Media.Ocr → raw text (viewer chrome, possible Unicode-bar substitutions, line-break artifacts)
  → HL7 normalization → cleaned HL7 v2 message string (canonical \r line endings, recovered |^~\& delimiters, viewer chrome stripped, common OCR confusions corrected)
  → engine.redact() → walker.parse (tokenization) → rule-pack match → redactor → TokenTree + redacted text
  → tokenized + redacted view (same UX as the paste flow)
```

Tokenization is the engine's existing `walker.parse` step, fed by the OCR + normalization stages upstream. The user-visible deliverable is the same TokenTree as the paste flow, just sourced from a screenshot.

### Components

- **OCR engine**: Windows.Media.Ocr via `windows` Rust crate. Built into Windows 10+, **zero bundle cost**, decent accuracy on clean rendered text (HL7-viewer screenshots are text on a controlled background, much easier than diagnostic imagery).
- **HL7 normalization** (`packages/core/src/normalize/hl7v2.ts`, pure TS, no UI/Tauri deps):
  - Canonicalize line endings to `\r`.
  - Strip viewer chrome: line numbers, segment-name labels (`PID:`, `OBX:`), ANSI escape sequences, alternating-row backgrounds rendered as repeated whitespace.
  - Recover delimiters: Unicode look-alikes (`｜` U+FF5C → `|`; `∧` → `^`; etc.); common OCR substitutions (`I`/`l`/`1` near segment-name boundary, `0`/`O` inside numeric components).
  - Output: `{ normalized: string, normalizationNotes: NormalizationNote[] }` so the UI can show what the cleanup did and let the user override.
  - Reusable: any HL7 v2 input source can run through normalization first; not specific to OCR.
- **UI**: ingest pane shows the OCR raw text alongside the normalized text; flags any normalization decisions with low confidence; user accepts/overrides before redaction commits.
- **Fallback**: if Windows.Media.Ocr accuracy is insufficient for a given viewer's rendering, tesseract.js WASM (~14 MB, English-only `tessdata_fast`) loaded lazily on demand.
- **Disclaimer compounds**: README and in-app surface "OCR is best-effort. Always verify the normalized text matches the original message before relying on the redacted output."

## Phase 7 — Local MCP server (design-only at this point)

The `@paste7/core` engine is UI-agnostic. Phase 7 wraps it as a local MCP server for AI-agent consumption.

- **Transport**: stdio JSON-RPC. Preserves the no-network threat model.
- **Tools exposed**:
  - `redact_hl7v2(message: string) -> { redacted, findings }`
  - `redact_hl7v3(xml: string) -> { redacted, findings }`
  - `redact_cda(xml: string) -> { redacted, findings }`
  - `redact_fhir(json_or_xml: string) -> { redacted, findings }`
  - `redact_dicom_sr_headers(dcm_path: string) -> { redacted_path, findings }`
  - `normalize_hl7v2(text: string) -> { normalized, notes }`
  - `detect_format(content: string) -> { format, confidence }`
- **Distribution**: separate npm package `@paste7/mcp` that depends on `@paste7/core`. User installs via `npx` or as a configured MCP server in their AI client.
- **Positioning**: "PHI redaction primitives for healthcare data MCP workflows." **Not** "HIPAA-compliant MCP" — compliance is operational, not code-level.
- **Why this is plausible**: the same in-memory-only, deterministic, no-network constraints that fit the desktop scratchpad also fit a local MCP server. The redaction primitives don't care if the caller is a UI button or an LLM tool call.

## Non-goals (explicit)

- DICOM pixel-data redaction of any kind (image-pixel PHI is a separate domain requiring clinical-context handling and is no longer in scope after the 2026-05-01 rescope)
- DICOM modalities other than Structured Report (SR) — CR, CT, MR, US, etc. are out of scope; tool will reject non-SR objects on file-drop
- DICOM SR ContentSequence (the structured report tree itself) — only header tags are redacted; the report content body is preserved verbatim
- HL7 v3 RIM message-type completeness beyond CDA-shared paths (long tail; add per user request)
- X12, NCPDP (out of scope unless user-driven)
- Free-text clinical narrative scrubbing (NLM Scrubber / Philter / ML territory)
- DICOM SCP listener or any inbound network service (would break the no-network threat model)
- Cloud egress, telemetry, analytics, error-reporting-to-vendor
- Vendor-specific format dialects (raw HL7 v2 only; not Mirth/Iguana variants)
- Certified HIPAA Safe Harbor compliance (best-effort dev tool, not a regulated medical device)
- "HIPAA-compliant MCP" branding (compliance is operational; framing is "PHI redaction primitives")

## Cross-cutting concerns

### In-memory invariants

All paste content, OCR'd image bytes, and DICOM source bytes stay in memory. The only disk artifact paths are:
- Settings (DPAPI-encrypted, no message content)
- DICOM SR redacted exports (user-initiated, already-sanitized output only)

CI enforces this via grep-based lint over `scratchpad/**` and `ocr/**` (no `writeTextFile`, no image-write APIs) and `dicom/**` (writes only paths matching `*.redacted.dcm`).

### Format detection ambiguity

A file claiming `<ClinicalDocument>` may be CDA R1, R2, or a v3-RIM message that happens to use the same root. Detector returns top-3 candidates with confidence; user can override.

### Trademark and affiliation

Product name "paste7" intentionally avoids phonetic of registered marks (HL7, FHIR are HL7 International trademarks). README and About box include explicit non-affiliation language. MCP server framing avoids "HIPAA-compliant" in favor of accurate operational language.
