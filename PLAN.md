# paste7 — Plan

A lightweight desktop scratchpad for inspecting healthcare interop messages with PHI auto-redaction. Per-user Windows installer, no admin rights, no network capabilities, in-memory only.

**Formats (paste UX)**: HL7 v2, HL7 v3 messaging, C-CDA, FHIR (JSON + XML).
**Formats (file-drop UX)**: DICOM headers (Phase 3); DICOM SC UI-screenshot pixel-data (Phase 6).

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
    app/
      src/
        scratchpad/         Paste view (Phase 2)
        dicom/              File-drop view (Phase 3 headers; Phase 6 pixel-data)
        shared/             Sidebar, Monaco, workflow registry — preserved
      src-tauri/          Tauri 2 Rust shell — preserved
        src/
          ocr.rs          (Phase 6) Windows.Media.Ocr binding for SC redaction
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

## Phase 3 — DICOM headers workflow

Different UX paradigm (file-drop, not paste). Separate workflow tab.

- **Drop area**: accepts `.dcm` files (single or multi-select).
- **Header table**: tag (Group,Element), VR, original value, redacted value. Sort/filter by tag or PHI status.
- **Redact-and-export**: writes sanitized `.dcm` next to original as `<name>.redacted.dcm`. Never overwrites source.
- **Bulk mode**: drop a folder; redact all `.dcm` in one pass; report summary.
- **Pixel-data redaction**: deferred to Phase 6, scoped to UI screenshots only.
- **Library**: `dicom-rs` (Rust side, exposed via Tauri command) or `dcmjs` (TS side). Pick during phase based on bundle-size and capability fit.
- **Rule pack**: DICOM PS 3.15 Basic Application Confidentiality Profile (~250 tags). Optional sub-profiles (retain-dates, retain-UIDs, retain-device-IDs) as user-configurable settings.

## Phase 4 — Security hardening

- **Tauri 2 capability scoping per workflow**:
  - Scratchpad: clipboard read/write only. No file I/O. No network.
  - DICOM: dialog open + sanitized file write only. No clipboard access. No network.
  - Both: shared deny-list — no shell, no terminal, no http, no environment access.
- **DPAPI for persistent state**: settings only (window size, default workflow, DICOM sub-profile selection). Never message content.
- **Code signing**: re-check SignPath Foundation eligibility. Fallbacks: Certum OSS (~$30/yr), SSL.com eSigner EV (~$349/yr), or unsigned pilot.
- **In-memory invariant lint**: scratchpad code path is checked by CI for any disk-writing call.
- **Branded `SecretValue` types**: any redacted/original message text wears a TS-level type that lacks `toJSON`, making accidental persistence a compile error.

## Phase 5 — Distribution

- Per-user NSIS installer (already configured at `tauri.conf.json: installMode = "currentUser"`).
- GitHub Releases via `npm run dist`.
- Tauri built-in updater fetching signed releases.
- README PHI disclaimer prominent in installer screen and app About box.

## Phase 6 — Pixel-data redaction (UI screenshots only)

Scope-limited to DICOM Secondary Capture objects containing **clean application UI screenshots** (high contrast, system fonts, predictable layout). Not for arbitrary diagnostic imaging or burned-in modality text.

- **OCR engine**: Windows.Media.Ocr via `windows` Rust crate. Built into Windows 10+, **zero bundle cost**, English (and 25+ other languages) supported, decent accuracy on clean UI text.
- **Pipeline** (Rust side):
  1. Decode DICOM SC pixel data → `SoftwareBitmap`
  2. `OcrEngine::RecognizeAsync()` → text + bounding boxes
  3. Filter detected text against the same PHI rule packs from Phase 1 (free-text match for SSN/phone/email/MRN patterns + fake-identity name list)
  4. Return regions for redaction
- **UI**: review pane shows detected regions + confidence scores; user accepts/overrides before export commits.
- **Redaction**: black-rectangle overlay at confirmed regions; pixel data re-encoded; export as `<name>.redacted.dcm`.
- **Fallback**: if Windows.Media.Ocr accuracy is insufficient on a given image type, tesseract.js WASM (~14 MB total, English-only `tessdata_fast`) loaded lazily on demand.
- **Disclaimer compounds**: README and in-app surface "OCR is best-effort, may miss PHI in pixels; manual review required before sharing."

## Phase 7 — Local MCP server (design-only at this point)

The `@paste7/core` engine is UI-agnostic. Phase 7 wraps it as a local MCP server for AI-agent consumption.

- **Transport**: stdio JSON-RPC. Preserves the no-network threat model.
- **Tools exposed**:
  - `redact_hl7v2(message: string) -> { redacted, findings }`
  - `redact_hl7v3(xml: string) -> { redacted, findings }`
  - `redact_cda(xml: string) -> { redacted, findings }`
  - `redact_fhir(json_or_xml: string) -> { redacted, findings }`
  - `redact_dicom_headers(dcm_path: string) -> { redacted_path, findings }`
  - `detect_format(content: string) -> { format, confidence }`
- **Distribution**: separate npm package `@paste7/mcp` that depends on `@paste7/core`. User installs via `npx` or as a configured MCP server in their AI client.
- **Positioning**: "PHI redaction primitives for healthcare data MCP workflows." **Not** "HIPAA-compliant MCP" — compliance is operational, not code-level.
- **Why this is plausible**: the same in-memory-only, deterministic, no-network constraints that fit the desktop scratchpad also fit a local MCP server. The redaction primitives don't care if the caller is a UI button or an LLM tool call.

## Non-goals (explicit)

- DICOM pixel-data redaction beyond clean UI screenshots (diagnostic imaging burned-in PHI is a separate domain requiring different OCR + clinical context handling)
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

All paste content and DICOM source bytes stay in memory. The only disk artifact paths are:
- Settings (DPAPI-encrypted, no message content)
- DICOM redacted exports (user-initiated, already-sanitized output only)

CI enforces this via grep-based lint over `scratchpad/**` (no `writeTextFile`) and `dicom/**` (writes only paths matching `*.redacted.dcm`).

### Format detection ambiguity

A file claiming `<ClinicalDocument>` may be CDA R1, R2, or a v3-RIM message that happens to use the same root. Detector returns top-3 candidates with confidence; user can override.

### Trademark and affiliation

Product name "paste7" intentionally avoids phonetic of registered marks (HL7, FHIR are HL7 International trademarks). README and About box include explicit non-affiliation language. MCP server framing avoids "HIPAA-compliant" in favor of accurate operational language.
