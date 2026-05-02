// Public types for @paste7/core. See docs/engine-contract.md for the design.

// -----------------------------------------------------------------------------
// Format
// -----------------------------------------------------------------------------

export type Format = "hl7v2" | "hl7v3" | "cda" | "fhir-json" | "fhir-xml";

export interface FormatDetection {
  format: Format;
  confidence: number;
  alternatives: ReadonlyArray<{ format: Format; confidence: number }>;
}

// -----------------------------------------------------------------------------
// PHI categories and redaction strategies
// -----------------------------------------------------------------------------

export type PHICategory =
  | "name"
  | "id"
  | "address"
  | "phone"
  | "email"
  | "date"
  | "geo"
  | "device-id"
  | "url"
  | "biometric"
  | "photo"
  | "free-text";

export type RedactStrategy =
  | "substitute"
  | "scrub"
  | "flag-only"
  | "remove";

export const DEFAULT_STRATEGIES: Readonly<Record<PHICategory, RedactStrategy>> = {
  name: "substitute",
  id: "substitute",
  address: "substitute",
  phone: "substitute",
  email: "substitute",
  date: "substitute",
  geo: "substitute",
  "device-id": "substitute",
  url: "substitute",
  biometric: "scrub",
  photo: "scrub",
  "free-text": "flag-only",
};

// -----------------------------------------------------------------------------
// Findings and errors
// -----------------------------------------------------------------------------

export interface Finding {
  /** Walker-format-specific path: "PID-5.1", "/ClinicalDocument/...", "Patient.name[0]". */
  path: string;
  category: PHICategory;
  strategy: RedactStrategy;
  /** Replacement value. Null only when strategy is "remove". */
  redactedValue: string | null;
  /** Length of the original value. The original itself is never exposed. */
  originalLength: number;
  /** Rule pack identifier that fired (e.g. "hl7v2/PID-5"). */
  rule: string;
  /** 0-1 confidence. Meaningful for free-text pattern matches; 1.0 for exact-path rules. */
  confidence: number;
}

export interface ParseError {
  /** Best-effort location indicator. */
  path: string;
  message: string;
  severity: "warning" | "error";
}

// -----------------------------------------------------------------------------
// Token tree (for tokenized UI rendering)
// -----------------------------------------------------------------------------

export type TokenKind =
  | "segment"
  | "field"
  | "repetition"
  | "component"
  | "subcomponent"
  | "element"
  | "attribute"
  | "property";

export interface TokenNode {
  /** Walker-format-specific path. */
  path: string;
  /** Human-readable label resolved from per-format dictionary. */
  label: string;
  kind: TokenKind;
  /** Redacted value, or original value if not redacted. Null only when "remove" strategy applied. */
  value: string | null;
  /** Present iff this node was redacted. */
  redaction?: {
    rule: string;
    category: PHICategory;
    strategy: RedactStrategy;
    originalLength: number;
  };
  children?: ReadonlyArray<TokenNode>;
}

export interface TokenTree {
  format: Format;
  nodes: ReadonlyArray<TokenNode>;
}

// -----------------------------------------------------------------------------
// Engine result, options, config
// -----------------------------------------------------------------------------

export interface RedactResult {
  format: Format;
  /** Only meaningful when format was auto-detected (no `options.format` supplied). */
  detectionConfidence: number;
  /** Serialized output in the input's format. Used for raw-text UI toggle and copy-out. */
  redacted: string;
  /** Structured representation. Used for tokenized UI rendering. */
  tree: TokenTree;
  findings: ReadonlyArray<Finding>;
  /** Non-fatal parse problems. Engine continues redaction on parseable subtree. */
  parseErrors: ReadonlyArray<ParseError>;
}

export interface RedactOptions {
  /** Skip auto-detection and use this format. */
  format?: Format;
  /** Strategy overrides on top of EngineConfig.strategies and DEFAULT_STRATEGIES. */
  strategies?: Partial<Record<PHICategory, RedactStrategy>>;
}

export interface EngineConfig {
  /** Identity pool override. Defaults to bundled Norse mythology pool. */
  pool?: IdentityPool;
  /** RNG seed for deterministic identity allocation. Auto-generated if absent. */
  seed?: number;
  /** Strategy overrides for the lifetime of this engine instance. */
  strategies?: Partial<Record<PHICategory, RedactStrategy>>;
}

// -----------------------------------------------------------------------------
// Identity pool (for substitution mode)
// -----------------------------------------------------------------------------

export interface NamePair {
  readonly family: string;
  readonly given: string;
}

export interface IdentityPool {
  readonly names: ReadonlyArray<NamePair>;
  readonly streetAddresses: ReadonlyArray<string>;
  readonly cities: ReadonlyArray<string>;
}

// -----------------------------------------------------------------------------
// Rule packs
// -----------------------------------------------------------------------------

export interface Rule {
  /** Exact path match. Mutually exclusive with `pattern`. */
  path?: string;
  /** Path regex match. Mutually exclusive with `path`. */
  pattern?: RegExp;
  category: PHICategory;
  /** Unique rule id; surfaces in findings for filtering and silencing. */
  rule: string;
  /** Override category default. */
  strategy?: RedactStrategy;
}

export interface RulePack {
  format: Format;
  rules: ReadonlyArray<Rule>;
}

// -----------------------------------------------------------------------------
// Internal contracts (walkers and redactor implementation surface)
// Re-exported for implementers; not part of the public consumer API.
// -----------------------------------------------------------------------------

export interface WalkerResult {
  redacted: string;
  tree: TokenTree;
  findings: ReadonlyArray<Finding>;
  parseErrors: ReadonlyArray<ParseError>;
}

export interface Walker<TInternal = unknown> {
  format: Format | ReadonlyArray<Format>;
  parse(input: string): { parsed: TInternal; parseErrors: ReadonlyArray<ParseError> };
  redact(
    parsed: TInternal,
    ruleset: RulePack,
    redactor: Redactor,
  ): WalkerResult;
}

export interface RedactRequest {
  category: PHICategory;
  value: string;
  strategy: RedactStrategy;
  path: string;
  rule: string;
}

export interface RedactResponse {
  /** Replacement value. Null when strategy is "remove". */
  value: string | null;
  finding: Finding;
}

export interface FreeTextScanRequest {
  value: string;
  path: string;
  rule: string;
}

export interface Redactor {
  apply(req: RedactRequest): RedactResponse;
  scanFreeText(req: FreeTextScanRequest): ReadonlyArray<Finding>;
}
