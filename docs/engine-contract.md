# Engine contract — `@paste7/core`

The contract for the PHI rule-pack engine. This is the load-bearing reference for Phase 1 implementation. Decisions captured here are locked unless explicitly rescoped.

**Status**: contract design (2026-04-30). No implementation yet. Phase 1 scaffolds against this doc.

---

## 1. Scope and goals

`@paste7/core` is a UI-agnostic TypeScript library that, given a healthcare interop message, returns:

1. The same message with PHI replaced by themed obvious-fakes
2. A structured token tree (for tokenized UI rendering)
3. Findings describing what was replaced

The engine has zero UI dependencies, zero Tauri dependencies, no network capabilities, and no disk I/O. It is the deterministic primitive that powers two consumers: the Tauri desktop UI today (Phase 2) and a local MCP server tomorrow (Phase 7).

Supported formats:

| Format | Walker | Detection signal |
|---|---|---|
| HL7 v2 | `walkers/hl7v2.ts` | First line starts with `MSH|` |
| HL7 v3 messaging | `walkers/xml.ts` | XML root with `urn:hl7-org:v3` namespace |
| C-CDA / CDA R2 | `walkers/xml.ts` | XML root `<ClinicalDocument>` with HL7 CDA namespace |
| FHIR JSON | `walkers/json.ts` | Top-level `resourceType` field |
| FHIR XML | `walkers/xml.ts` | XML root with `http://hl7.org/fhir` namespace |

DICOM headers (Phase 3) reuse the same engine via a separate walker over the parsed `DataSet`; that walker is out of scope for this doc.

---

## 2. Top-level API

```typescript
// @paste7/core/index.ts

export function createEngine(config?: EngineConfig): Engine;

export interface Engine {
  /** Detect format, parse, redact, return result. */
  redact(input: string, options?: RedactOptions): Promise<RedactResult>;

  /** Detect format only; useful for the UI to show format-confidence before commit. */
  detectFormat(input: string): Promise<FormatDetection>;

  /** Drop all session state (binding map, identity pool position). */
  reset(): void;
}

export interface EngineConfig {
  /** Identity pool override; defaults to bundled Norse mythology pool. */
  pool?: IdentityPool;
  /** RNG seed for deterministic identity allocation; auto-generated if absent. */
  seed?: number;
  /** Strategy overrides per category. */
  strategies?: Partial<Record<PHICategory, RedactStrategy>>;
}

export interface RedactOptions {
  /** Override format detection. */
  format?: Format;
  /** Per-call strategy override (applied on top of EngineConfig.strategies). */
  strategies?: Partial<Record<PHICategory, RedactStrategy>>;
}

export interface RedactResult {
  format: Format;
  detectionConfidence: number;       // 0-1, only meaningful if format was auto-detected
  redacted: string;                  // serialized output in input's format (for raw-text UI toggle, copy-out)
  tree: TokenTree;                   // structured representation (for tokenized UI rendering)
  findings: ReadonlyArray<Finding>;
  parseErrors: ReadonlyArray<ParseError>;  // non-fatal; redaction proceeds best-effort
}

export interface FormatDetection {
  format: Format;
  confidence: number;
  alternatives: ReadonlyArray<{ format: Format; confidence: number }>;
}
```

**Async** even though most operations are CPU-bound. Future-proofs for DICOM file I/O and MCP stdio transport without an API break later.

**Engine instance per session.** Each `createEngine()` call owns its own state. The Tauri UI creates a new engine per paste action; an MCP server creates one per stdio connection.

---

## 3. Types

### Format

```typescript
export type Format = "hl7v2" | "hl7v3" | "cda" | "fhir-json" | "fhir-xml";
```

Five format identifiers; three walkers cover them.

### PHICategory

The HIPAA Safe Harbor 18 identifiers collapsed into operational categories:

```typescript
export type PHICategory =
  | "name"           // patient/family/given/middle/prefix/suffix
  | "id"             // MRN, SSN, account, insurance, identifier values
  | "address"        // street, city, postal, county
  | "phone"          // tel, fax
  | "email"
  | "date"           // DOB and dates more precise than year for ages > 89
  | "geo"            // lat/long, GPS
  | "device-id"      // serial numbers, UDI
  | "url"            // patient-specific URLs
  | "biometric"      // fingerprints, voice prints (binary)
  | "photo"          // facial photographs (binary)
  | "free-text";     // narrative content; flag-only by default
```

### RedactStrategy

```typescript
export type RedactStrategy =
  | "substitute"    // replace with deterministic fake from identity pool
  | "scrub"         // replace with literal placeholder ("[REDACTED]" or category-specific)
  | "flag-only"     // leave value; record finding only
  | "remove";       // delete the value entirely (XML element gone, JSON property unset)
```

**Defaults** (overridable via `EngineConfig.strategies` or `RedactOptions.strategies`):

| Category | Default | Rationale |
|---|---|---|
| `name`, `id`, `address`, `phone`, `email`, `date`, `geo`, `device-id`, `url` | `substitute` | Themed obvious-fake replacements preserve message structure for downstream parsers |
| `free-text` | `flag-only` | Auto-rewriting clinical narrative is content-destruction risk and not Safe Harbor's intent |
| `biometric`, `photo` | `scrub` | Cannot meaningfully substitute binary content |

`remove` is not a default for any category — removing structural fields breaks parser round-trip. User-overridable.

### Finding

```typescript
export interface Finding {
  path: string;                  // walker-format-specific (e.g. "PID-5.1" or "Patient.name[0].given[0]")
  category: PHICategory;
  strategy: RedactStrategy;
  redactedValue: string | null;  // null only for "remove"
  originalLength: number;        // for UI; never the raw value
  rule: string;                  // rule-pack id that fired (e.g. "hl7v2/PID-5")
  confidence: number;            // 0-1; meaningful for free-text pattern matches
}
```

**Findings never carry the original PHI value.** Trust is established by reading the redacted view, not by comparing against originals. UI shows path + category + length + redacted output; user verifies visually.

### ParseError

```typescript
export interface ParseError {
  path: string;        // best-effort location indicator
  message: string;
  severity: "warning" | "error";
}
```

Non-fatal. Engine continues with best-effort redaction even on malformed input.

---

## 4. Token tree (for tokenized UI rendering)

The engine produces a structured tree alongside the serialized redacted text. UI renders the tree as expandable lines; raw-text toggle shows `redacted` instead.

```typescript
export interface TokenTree {
  format: Format;
  nodes: ReadonlyArray<TokenNode>;
}

export interface TokenNode {
  path: string;                              // "PID-5", "/ClinicalDocument/recordTarget/...", "Patient.name[0].given[0]"
  label: string;                             // "Patient Name" — resolved from per-format dictionary
  kind: "segment" | "field" | "component" | "element" | "attribute" | "property";
  value: string | null;                      // redacted value (or original if not PHI)
  redaction?: {                              // present iff this node was redacted
    rule: string;
    category: PHICategory;
    strategy: RedactStrategy;
    originalLength: number;
  };
  children?: ReadonlyArray<TokenNode>;       // nested expansion
}
```

**Expansion behavior** (UI-side, but the tree must support it):
- HL7 v2: top-level segments → fields → (on click) components → subcomponents
- XML formats: elements → child elements → (on click) attributes
- FHIR JSON: resource → property → (on click) nested resources/arrays

Engine produces the full tree; UI controls visible depth.

---

## 5. Walker contract

Three walkers in `packages/core/src/walkers/`. Each implements:

```typescript
export interface Walker {
  format: Format | Format[];

  /** Parse raw input into walker-internal AST. */
  parse(input: string): WalkerInternal;

  /**
   * Apply rule pack and redactor; produce both serialized text and structured tree.
   * Walker calls redactor.redact(category, value) for each rule hit and writes the
   * returned value back into the AST.
   */
  redact(parsed: WalkerInternal, ruleset: RulePack, redactor: Redactor): {
    redacted: string;
    tree: TokenTree;
  };
}
```

`WalkerInternal` is opaque to the engine — each walker defines its own AST shape.

### Path syntax (format-specific by design)

Rule packs are format-scoped; uniform path syntax across formats adds translation cost without benefit.

| Format | Path syntax | Example |
|---|---|---|
| HL7 v2 | `SEG-N[.M[.K]]` | `PID-5.1`, `OBX-5.4.2` |
| HL7 v3, CDA, FHIR XML | XPath-style absolute path | `/ClinicalDocument/recordTarget/patientRole/patient/name/given` |
| FHIR JSON | Dot-bracket path | `Patient.name[0].given[0]`, `Bundle.entry[2].resource.identifier[0].value` |

---

## 6. Rule pack format

TS object literal — typed, importable, supports both exact paths and regex patterns.

```typescript
// rules/hl7v2.ts (excerpt)
export const HL7V2_RULES: RulePack = {
  format: "hl7v2",
  rules: [
    { path: "PID-3",      category: "id",      rule: "hl7v2/PID-3" },
    { path: "PID-5",      category: "name",    rule: "hl7v2/PID-5" },
    { path: "PID-7",      category: "date",    rule: "hl7v2/PID-7" },
    { path: "PID-11",     category: "address", rule: "hl7v2/PID-11" },
    { path: "PID-13",     category: "phone",   rule: "hl7v2/PID-13" },
    { path: "PID-19",     category: "id",      rule: "hl7v2/PID-19" },  // SSN
    { pattern: /^OBX-5/,  category: "free-text", rule: "hl7v2/OBX-5", strategy: "flag-only" },
    { pattern: /^NTE-3/,  category: "free-text", rule: "hl7v2/NTE-3", strategy: "flag-only" },
    // ... full PID/NK1/GT1/IN1/IN2/MSH-4,6 coverage
  ],
};

interface Rule {
  path?: string;             // exact match
  pattern?: RegExp;          // path regex
  category: PHICategory;
  rule: string;              // unique id; surfaces in findings + UI silencing
  strategy?: RedactStrategy; // overrides category default
}
```

Rule packs ship in `rules/{hl7v2,hl7v3,cda,fhir}.ts`. CDA and HL7 v3 share many paths (RIM-derived); avoid duplication via composition.

---

## 7. Substitution: themed obvious-fake

**Pool**: ~100 Norse-mythology entries shipped in `packages/core/src/identities.ts`.

**Allocation**: deterministic per session.

```typescript
// Internal session state
interface SessionState {
  pool: IdentityPool;
  poolPositions: Record<PHICategory, number>;     // sequential cursor per category
  bindings: Map<string, string>;                  // sha256(category||original) -> assigned fake
  rngSeed: number;                                // deterministic shuffle
}
```

**Algorithm**:
1. Compute `key = sha256(category + originalValue)` — hashed so heap dumps don't leak originals.
2. If `bindings[key]` exists → return it (cross-message consistency).
3. Otherwise: allocate next pool entry at `poolPositions[category]`, increment cursor, store binding, return.
4. On cursor wrap (more unique values than pool size): append index suffix (`THUNDERER^THOR_2`).

**Numeric formats** stay format-correct so downstream parsers don't reject:

| Category | Pattern | Example |
|---|---|---|
| `id` (MRN) | `MRN-FAKE-NNNN` (sequential) | `MRN-FAKE-0042` |
| `id` (SSN) | `000-00-NNNN` (NANP-invalid) | `000-00-0001` |
| `id` (account) | `ACCT-FAKE-NNNN` | `ACCT-FAKE-0007` |
| `phone` | `555-01NN` (NANP fictional range) | `555-0100` |
| `email` | `user-NN@placeholder.invalid` | `user-12@placeholder.invalid` |
| `date` | `1950-01-01` baseline (Safe Harbor: dates more precise than year for ages > 89 must be removed) | `19500101` (HL7 format) |
| `geo` | `0.0,0.0` | `0.0,0.0` |

**Names** drawn from Norse pool — pairs of `DESCRIPTOR^NAME` for HL7 v2 XPN format, with appropriate restructuring for FHIR HumanName.

**Addresses** themed: `1 BIFROST BRIDGE^^ASGARD^XX^00001`, `1 YGGDRASIL ROOT^^MIDGARD^XX^00002`, ... ~20 entries.

---

## 8. Free-text scanning

Free-text-flagged fields (default: `OBX-5`, `NTE-3`, CDA `<text>`, FHIR `narrative.div`) get a regex pass for embedded PHI patterns:

```typescript
const FREE_TEXT_SCANNERS: ReadonlyArray<{ pattern: RegExp; category: PHICategory }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, category: "id" },                       // SSN
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, category: "phone" },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, category: "email" },
  // Names: matched against the session's already-bound name set (treat known patient names
  // as suspect if they appear in narrative)
];
```

Default strategy: `flag-only`. Findings emit; original text is preserved. User may override per-call to `scrub` for known-narrative-redaction workflows.

---

## 9. Label dictionary

Per-format human-readable labels for `TokenNode.label`. Sourced from OSS dictionaries, not hand-written:

| Format | Source | Vendor location |
|---|---|---|
| HL7 v2 (v2.3 - v2.8) | [`hl7-dictionary`](https://www.npmjs.com/package/hl7-dictionary) (npm, MIT) | dependency |
| FHIR R4 | hl7.org StructureDefinition bundle, distilled to label-only JSON | `packages/core/data/fhir-r4-labels.json` |
| FHIR R5 | hl7.org StructureDefinition bundle, distilled | `packages/core/data/fhir-r5-labels.json` |
| CDA R2 | Hand-curated from CDA R2 spec (~50 elements) | `packages/core/src/labels/cda.ts` |
| HL7 v3 messaging | Shared paths with CDA only; non-CDA paths render as "Unknown" | `packages/core/src/labels/hl7v3.ts` |

Resolver API:

```typescript
// labels/hl7v2.ts
export function getLabel(path: string, version: string): string;

// labels/fhir.ts
export function getLabel(path: string, resourceType: string, version: "R4" | "R5"): string;
```

**Version detection**:
- HL7 v2: read `MSH-12` (e.g. `"2.5"`); fall back to v2.5 if absent
- FHIR JSON: read `resourceType` and optional `meta.profile`; default to R4
- FHIR XML: read root element + namespace
- CDA: read `templateId` codes; default to base R2

Unknown paths render as the path itself (e.g. `Z-segment ZXX-3` shows `"ZXX-3"` as the label).

---

## 10. Engine flow (full path)

For each `engine.redact(input, options)` call:

1. **Detect format** via `format-detect.ts` (or use `options.format`)
2. **Pick walker** for that format
3. **`walker.parse(input)`** → walker-internal AST
4. **Look up rule pack** for the format
5. **`walker.redact(parsed, ruleset, redactor)`**:
   - For each leaf node: match path against rule pack
   - Hit: invoke `redactor.redact(category, value, strategy)` → assign or look up binding → write back
   - Miss + free-text-flagged: run scanners; emit findings; preserve value
   - Miss + not free-text: preserve value
6. **Emit serialized text and TokenTree** in parallel (one walk; both outputs)
7. **Return** `{ format, redacted, tree, findings, parseErrors }`

---

## 11. Error handling

- **Malformed input**: parse best-effort, emit `ParseError` entries, continue redaction on parseable subtree
- **Unknown format**: detector returns lowest confidence with all candidates listed; engine throws if `options.format` was not set and confidence < 0.5
- **Unknown segment / element**: walker emits TokenNode with path-as-label; rule pack doesn't fire; no redaction. Findings unchanged.
- **Pool exhaustion**: append numeric suffix to wrapped pool entry
- **Binding collision** (sha256, theoretically possible): impossible at our volumes; not handled

---

## 12. UI integration notes (for Phase 2)

The engine doesn't dictate UI but tokenized view requires specific data shapes. Locked UI choices:

- **No diff editor.** Tokenized view IS the redaction-trust mechanism.
- **Raw-text toggle prominent in UI chrome.** Shows `redacted` string for copy-out workflows.
- **Components/subcomponents expand on click.** Engine produces full tree; UI controls visible depth via `children` traversal.
- **Findings panel** filters by category, rule, or path. Searchable.

---

## 13. Configuration not in v1

Locked as deferred:

- Per-jurisdiction profiles (GDPR, UK DPA, etc.) → Phase 4 if user demand
- HIPAA sub-profiles (retain dates, retain device IDs, retain UIDs) → Phase 4
- Custom rule packs (user-supplied) → Phase 4 if user demand
- Realistic-plausible-fake substitution mode → not planned (industry-incident risk)
- Literal-placeholder substitution mode → not planned (chose themed instead)

---

## 14. Decisions log

| # | Decision | Locked |
|---|---|---|
| 1 | Async API even though internals are sync | ✅ |
| 2 | Engine instance per session (not global singleton) | ✅ |
| 3 | Findings exclude originals; only `originalLength` exposed | ✅ |
| 4 | Format-specific path syntax | ✅ |
| 5 | Free-text default strategy: `flag-only` | ✅ |
| 6 | Substitution: themed obvious-fake, Norse mythology pool, ~100 entries | ✅ |
| 7 | `remove` strategy default: `biometric` and `photo` only | ✅ |
| 8 | HIPAA sub-profiles deferred to Phase 4 | ✅ |
| UI-A | Tokenized view (no diff editor) | ✅ |
| UI-B | Prominent raw-text view toggle | ✅ |
| UI-C | Components/subcomponents expand on click | ✅ |
| Catalog | Full v2 (`hl7-dictionary`) + FHIR R4/R5 (vendored) + CDA R2 (curated) | ✅ |

---

## 15. What's not in this contract

- DICOM walker (Phase 3 — separate doc when designed)
- Pixel-data OCR pipeline (Phase 6 — Windows.Media.Ocr binding)
- MCP server transport (Phase 7 — wraps this engine, doesn't change it)
- Rust-side Tauri command shape for any of the above
- Specific PHI field paths per format — see `docs/phi-field-map.md` (Phase 1 deliverable, not yet written)

---

## Implementation order (Phase 1)

1. Engine API surface + types (`index.ts` exports, this doc's section 2/3)
2. Format detector (`format-detect.ts`)
3. Walker contract + the three walkers, in dependency order:
   - `walkers/hl7v2.ts` first (most familiar; smallest scope)
   - `walkers/json.ts` (structurally simplest)
   - `walkers/xml.ts` (covers three formats)
4. Identity pool + redactor (`identities.ts`, `redact.ts`)
5. Rule packs in dependency order: hl7v2 → fhir → cda → hl7v3
6. Label dictionary integration
7. Property-based tests on synthetic fixtures (no real PHI in repo, ever)

Then Phase 2 wires the engine into the Scratchpad UI.
