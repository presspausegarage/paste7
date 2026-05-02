// DICOM SR header redactor.
//
// Pipeline per redactSrHeaders call:
//   1. dcmjs parses the DICOM Part 10 file (preamble + DICM + file meta + dataset).
//   2. SOP Class UID extracted from File Meta (0002,0002) → validated via
//      isSrSopClass(); throws on non-SR with a clear error.
//   3. Walks DEFAULT_DICOM_SR_RULES; for each present tag, applies the
//      strategy (remove | scrub | substitute) honoring sub-profile retain flags.
//   4. dcmjs re-serializes the redacted dataset to bytes.
//
// PN values: dcmjs decodes Person Names to `[{ Alphabetic, Phonetic?,
// Ideographic? }]`. We feed Alphabetic (the canonical PS 3.5 family^given
// form) to the engine redactor — the engine's name generator handles the
// `^` separator natively from HL7 v2 (XPN shares the format) — and re-wrap
// the result.
//
// UIDs (VR=UI) get their own re-map cache backed by DicomMetaDictionary.uid()
// (`2.25.<random>`). Same input UID → same fake within the redactor session,
// so cross-tag UID references (Study/Series/Frame-of-Reference cross-links,
// SOP Instance UID showing up in File Meta + Dataset) stay consistent.
//
// Sequence (VR=SQ) tags in this rule pack only carry "remove" or "scrub"
// strategies — we do not recurse into sequence items. ContentSequence
// (0040,A730) and AcquisitionContext (0040,0555) are not in the rule pack
// and are preserved verbatim.

/// <reference path="./dcmjs.d.ts" />

import dcmjs, { type DicomDict } from "dcmjs";

import { createRedactor } from "../redact.js";
import type {
  Finding,
  ParseError,
  PHICategory,
  RedactStrategy,
} from "../types.js";

import { DEFAULT_DICOM_SR_RULES } from "./rules.js";
import {
  getSrSopClassName,
  isSrSopClass,
  SR_SOP_CLASS_PREFIX,
} from "./sop-classes.js";
import type {
  DicomFinding,
  DicomRedactResult,
  DicomRedactor,
  DicomRedactorConfig,
  DicomRule,
} from "./types.js";

// dcmjs's data namespace — narrow alias keeps the imports focused.
const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

// File Meta SOP Class UID = (0002,0002); Dataset SOP Class UID = (0008,0016).
const FILE_META_SOP_CLASS_TAG = "00020002";
const DATASET_SOP_CLASS_TAG = "00080016";

// File Meta lives under group 0002; everything else is in the dataset.
function isFileMetaTag(unpunctuated: string): boolean {
  return unpunctuated.startsWith("0002");
}

// PN Value entries from dcmjs are objects with up to three group fields.
interface PNValueObject {
  Alphabetic?: string;
  Phonetic?: string;
  Ideographic?: string;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function extractPnAlphabetic(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (isPlainObject(value) && typeof value.Alphabetic === "string") {
    return value.Alphabetic;
  }
  return undefined;
}

function wrapPn(alphabetic: string): PNValueObject {
  return { Alphabetic: alphabetic };
}

/**
 * Extract a string view of a tag's value for redactor input. For most VRs
 * the value is already a string; PN unwraps to Alphabetic; UI is a string
 * UID. Returns undefined when the value is missing or has an unexpected
 * shape (the caller treats this as a parse warning and skips).
 */
function extractStringValue(vr: string, raw: unknown): string | undefined {
  if (vr === "PN") return extractPnAlphabetic(raw);
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  return undefined;
}

/** Re-encode a redacted string into the per-VR Value shape. */
function reencodeValue(vr: string, fake: string): unknown {
  if (vr === "PN") return wrapPn(fake);
  return fake;
}

/**
 * Sub-profile gate: if the rule is retainable and the matching config flag
 * is set, the rule does not apply (original value is preserved).
 */
function shouldRetain(rule: DicomRule, config: DicomRedactorConfig): boolean {
  if (rule.retainable === undefined) return false;
  if (rule.retainable === "dates" && config.retainDates) return true;
  if (rule.retainable === "uids" && config.retainUids) return true;
  if (rule.retainable === "device-ids" && config.retainDeviceIds) return true;
  return false;
}

interface RuleApplication {
  finding: DicomFinding;
  /** "remove" → delete the tag; "replace" → set Value; "skip" → no-op. */
  action: "remove" | "replace" | "skip";
  /** When action is "replace". */
  newValue?: unknown[];
}

interface RedactorLike {
  apply(req: {
    category: PHICategory;
    value: string;
    strategy: RedactStrategy;
    path: string;
    rule: string;
  }): { value: string | null };
}

interface UidCache {
  remap(originalUid: string): string;
}

function makeUidCache(): UidCache {
  const cache = new Map<string, string>();
  return {
    remap(originalUid: string): string {
      let fake = cache.get(originalUid);
      if (fake === undefined) {
        fake = DicomMetaDictionary.uid();
        cache.set(originalUid, fake);
      }
      return fake;
    },
  };
}

function applyRule(
  rule: DicomRule,
  vr: string,
  rawValue: unknown[],
  redactor: RedactorLike,
  uidCache: UidCache,
): RuleApplication {
  // Common metadata for the finding.
  const baseFinding = {
    tag: rule.tag,
    vr,
    name: rule.name,
    path: rule.tag,
    category: rule.category,
    rule: rule.rule,
    confidence: 1,
  };

  // Total length across multi-value entries — best-effort proxy for
  // "how much PHI did we just redact?"
  const originalLength = rawValue
    .map((v) => extractStringValue(vr, v) ?? "")
    .reduce((sum, s) => sum + s.length, 0);

  if (rule.strategy === "remove") {
    return {
      action: "remove",
      finding: {
        ...baseFinding,
        strategy: "remove",
        redactedValue: null,
        originalLength,
      },
    };
  }

  if (rule.strategy === "scrub") {
    return {
      action: "replace",
      newValue: [],
      finding: {
        ...baseFinding,
        strategy: "scrub",
        redactedValue: "",
        originalLength,
      },
    };
  }

  if (rule.strategy === "substitute") {
    // UI gets UID-shape fakes from our cache. Multi-value UI is rare but
    // handled element-wise.
    if (vr === "UI") {
      const newValue = rawValue.map((v) => {
        const original = typeof v === "string" ? v : "";
        return original === "" ? "" : uidCache.remap(original);
      });
      const fakeStr = newValue.length === 1 ? String(newValue[0]) : newValue.join("\\");
      return {
        action: "replace",
        newValue,
        finding: {
          ...baseFinding,
          strategy: "substitute",
          redactedValue: fakeStr,
          originalLength,
        },
      };
    }

    // Non-UI substitute goes through the engine redactor (shape-aware
    // fakes for names, ids, addresses, phones, dates, etc.).
    const newValue: unknown[] = [];
    const fakeStrings: string[] = [];
    for (const item of rawValue) {
      const valueStr = extractStringValue(vr, item);
      if (valueStr === undefined) {
        newValue.push(item); // unexpected shape; preserve verbatim
        continue;
      }
      const response = redactor.apply({
        category: rule.category,
        value: valueStr,
        strategy: "substitute",
        path: rule.tag,
        rule: rule.rule,
      });
      if (response.value === null) {
        // shouldn't happen for substitute, but guard anyway
        continue;
      }
      newValue.push(reencodeValue(vr, response.value));
      fakeStrings.push(response.value);
    }
    return {
      action: "replace",
      newValue,
      finding: {
        ...baseFinding,
        strategy: "substitute",
        redactedValue: fakeStrings.join("\\"),
        originalLength,
      },
    };
  }

  // strategy === "flag-only" — not used in the SR rule pack, but be safe.
  return {
    action: "skip",
    finding: {
      ...baseFinding,
      strategy: rule.strategy,
      redactedValue: rawValue.map((v) => extractStringValue(vr, v) ?? "").join("\\"),
      originalLength,
    },
  };
}

function readSopClassUid(dicomDict: DicomDict): string | undefined {
  const fileMeta = dicomDict.meta?.[FILE_META_SOP_CLASS_TAG];
  const dataset = dicomDict.dict?.[DATASET_SOP_CLASS_TAG];
  const candidate =
    (fileMeta?.Value?.[0] as string | undefined) ??
    (dataset?.Value?.[0] as string | undefined);
  return typeof candidate === "string" ? candidate : undefined;
}

function uint8ToArrayBuffer(input: Uint8Array): ArrayBuffer {
  // Slice to a fresh ArrayBuffer to avoid issues when `input` is a view
  // over a larger underlying buffer (e.g. from a fs.readFile shared pool).
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}

export function createDicomRedactor(config: DicomRedactorConfig = {}): DicomRedactor {
  const redactor = createRedactor({ pool: config.pool });
  let uidCache = makeUidCache();

  return {
    async redactSrHeaders(input: Uint8Array): Promise<DicomRedactResult> {
      const parseErrors: ParseError[] = [];

      let dicomDict: DicomDict;
      try {
        dicomDict = DicomMessage.readFile(uint8ToArrayBuffer(input));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`DICOM parse failed: ${message}`);
      }

      const sopClassUid = readSopClassUid(dicomDict);
      if (sopClassUid === undefined) {
        throw new Error(
          "DICOM input is missing Media Storage SOP Class UID (0002,0002) — cannot validate SR scope.",
        );
      }
      if (!isSrSopClass(sopClassUid)) {
        throw new Error(
          `SOP Class ${sopClassUid} is not in the SR family (${SR_SOP_CLASS_PREFIX}*). paste7 only redacts Structured Report objects.`,
        );
      }

      const findings: DicomFinding[] = [];

      for (const rule of DEFAULT_DICOM_SR_RULES) {
        if (shouldRetain(rule, config)) continue;

        const unpunctuated = DicomMetaDictionary.unpunctuateTag(rule.tag);
        const targetDict = isFileMetaTag(unpunctuated) ? dicomDict.meta : dicomDict.dict;
        const entry = targetDict[unpunctuated];
        if (entry === undefined) continue; // tag not present in this file

        const rawValue = Array.isArray(entry.Value) ? entry.Value : [];
        if (rawValue.length === 0 && rule.strategy !== "remove") {
          // Empty value already; no-op for scrub/substitute (PS 3.15 treats
          // an already-empty Z-value as compliant). Skip silently.
          continue;
        }

        const result = applyRule(rule, entry.vr, rawValue, redactor, uidCache);

        if (result.action === "remove") {
          delete targetDict[unpunctuated];
        } else if (result.action === "replace" && result.newValue !== undefined) {
          entry.Value = result.newValue;
        }
        findings.push(result.finding);
      }

      let redactedBuffer: ArrayBuffer;
      try {
        redactedBuffer = dicomDict.write();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`DICOM serialize failed: ${message}`);
      }

      return {
        sopClassUid,
        sopClassName: getSrSopClassName(sopClassUid),
        redacted: new Uint8Array(redactedBuffer),
        findings,
        parseErrors,
      };
    },

    reset(): void {
      redactor.reset();
      uidCache = makeUidCache();
    },
  };
}
