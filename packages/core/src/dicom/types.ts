// Public types for the DICOM SR redactor. See PLAN.md Phase 3.
//
// Why a separate surface from `engine.redact(string)`:
// - DICOM input is binary (Uint8Array), not a tokenizable text format.
// - Output is also binary (sanitized .dcm bytes), not a string.
// - Findings carry DICOM-specific shape (group/element tag, VR, SOP Class).
// - SR ContentSequence is preserved verbatim — there's no walker tree to
//   render the way the text engines render TokenTree.
//
// The two surfaces share primitives (createRedactor, IdentityPool,
// PHICategory, RedactStrategy) — they don't share the orchestrator.

import type { Finding, IdentityPool, ParseError, PHICategory, RedactStrategy } from "../types.js";

// -----------------------------------------------------------------------------
// Rule packs
// -----------------------------------------------------------------------------

/**
 * Sub-profile gating per PS 3.15 Annex E. When the matching `retain*`
 * config flag is true, the walker leaves the original value in place
 * instead of applying the redaction strategy.
 */
export type DicomRetainProfile = "dates" | "uids" | "device-ids";

/**
 * One rule for a DICOM tag in the SR header surface. Tags are formatted
 * as `(GGGG,EEEE)` with uppercase hex (e.g. `(0010,0010)` for PatientName).
 * Tags marked K (keep) per PS 3.15 are simply omitted from the pack —
 * no rule means the walker preserves the value verbatim.
 */
export interface DicomRule {
  /** Group/element formatted as `(GGGG,EEEE)`, uppercase hex. */
  tag: string;
  /** DICOM Value Representation code (PN, DA, UI, ...). */
  vr: string;
  /** Standardized DICOM dictionary name. */
  name: string;
  category: PHICategory;
  strategy: RedactStrategy;
  /** Unique rule id for findings filtering / silencing. */
  rule: string;
  /**
   * If set, this rule is gated by the corresponding sub-profile flag.
   * When the flag is true, the walker preserves the original value;
   * when false (default), the rule applies normally.
   */
  retainable?: DicomRetainProfile;
}

export interface DicomRulePack {
  rules: ReadonlyArray<DicomRule>;
}

/**
 * Redact-and-serialize result for a single DICOM SR object.
 */
export interface DicomRedactResult {
  /** SOP Class UID extracted from File Meta (0002,0002) Media Storage SOP Class UID. */
  sopClassUid: string;
  /** Standardized SOP Class name from KNOWN_SR_SOP_CLASSES, if recognized. */
  sopClassName?: string;
  /**
   * Sanitized DICOM bytes. Same SOP Class, same ContentSequence (preserved
   * verbatim), redacted header-module tags. Caller writes these to
   * `<original>.redacted.dcm`.
   */
  redacted: Uint8Array;
  /** Per-tag redaction outcomes. */
  findings: ReadonlyArray<DicomFinding>;
  /** Non-fatal parse problems. Redactor continues on parseable subtree. */
  parseErrors: ReadonlyArray<ParseError>;
}

/**
 * One PHI redaction outcome on a DICOM tag. Extends the engine's `Finding`
 * shape with DICOM-specific tag + VR fields. `path` is the formatted tag
 * (e.g. "(0010,0010)") to align with the engine's `Finding.path` slot;
 * the redundant `tag` and `vr` fields make the UI's job easier without
 * forcing it to parse `path`.
 */
export interface DicomFinding extends Finding {
  /** Group/element formatted as "(GGGG,EEEE)", uppercase hex. */
  tag: string;
  /** DICOM Value Representation (PN, DA, UI, ...). */
  vr: string;
  /** Standardized DICOM dictionary name (e.g. "Patient's Name"). */
  name: string;
}

export interface DicomRedactorConfig {
  /** Identity pool override. Defaults to bundled Norse mythology pool. */
  pool?: IdentityPool;
  /** RNG seed for deterministic identity allocation. */
  seed?: number;
  /** Strategy overrides on top of DEFAULT_STRATEGIES. */
  strategies?: Partial<Record<PHICategory, RedactStrategy>>;
  /** PS 3.15 sub-profile: retain calendar dates rather than zeroing them. */
  retainDates?: boolean;
  /** PS 3.15 sub-profile: retain UIDs (Study/Series/SOP Instance) rather than re-mapping. */
  retainUids?: boolean;
  /** PS 3.15 sub-profile: retain device-identification tags (Manufacturer, Model, Station Name). */
  retainDeviceIds?: boolean;
}

/**
 * DICOM SR header redactor. One instance owns one session of redaction
 * state (identity bindings, UID re-map cache). Multiple successive files
 * within the same session share the binding map for cross-file consistency.
 */
export interface DicomRedactor {
  /**
   * Redact PHI in the header tags of an SR DICOM object. Throws if the
   * SOP Class is not in the SR family (caller should call
   * `isSrSopClass()` first to give the user a friendlier error).
   */
  redactSrHeaders(input: Uint8Array): Promise<DicomRedactResult>;

  /** Drop session state (binding map, UID re-map cache, identity pool position). */
  reset(): void;
}
