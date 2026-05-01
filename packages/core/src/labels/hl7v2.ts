// HL7 v2 label resolver. Backed by the `hl7-dictionary` npm package which
// vendors HL7 v2 segment + field definitions for v2.1 through v2.7.1.
//
// Path syntax recap (engine-contract section 5):
//   SEG          → segment-level label
//   SEG-N        → field-level label
//   SEG-N.M      → component-level label (deferred — requires datatype lookup)
//   SEG-N.M.K    → subcomponent-level label (deferred)
//
// Version is detected from MSH-12 by the walker; resolver falls back to v2.5
// when no version is supplied (most-common deployed v2 version).

import dict from "hl7-dictionary";

const SUPPORTED_VERSIONS = [
  "2.1",
  "2.2",
  "2.3",
  "2.3.1",
  "2.4",
  "2.5",
  "2.5.1",
  "2.6",
  "2.7",
  "2.7.1",
] as const;

const DEFAULT_VERSION = "2.5";

const PATH_RE = /^([A-Z][A-Z0-9]{2})(?:-(\d+))?(?:\.(\d+))?(?:\.(\d+))?$/;

function normalizeVersion(version: string | undefined): string {
  if (!version) return DEFAULT_VERSION;
  if (SUPPORTED_VERSIONS.includes(version as (typeof SUPPORTED_VERSIONS)[number])) {
    return version;
  }
  // Try downgrade to the closest supported version (e.g. "2.5.2" → "2.5.1" → "2.5").
  for (const supported of [...SUPPORTED_VERSIONS].reverse()) {
    if (version.startsWith(supported)) return supported;
  }
  return DEFAULT_VERSION;
}

/**
 * Resolve a human-readable label for an HL7 v2 path. Returns the path itself
 * when no dictionary entry exists (e.g. Z-segments, unknown versions).
 */
export function getLabel(path: string, version?: string): string {
  const m = PATH_RE.exec(path);
  if (!m) return path;
  const segName = m[1]!;
  const fieldStr = m[2];
  const compStr = m[3];
  const subStr = m[4];

  const v = normalizeVersion(version);
  const defs = dict.definitions[v];
  const segDef = defs?.segments?.[segName];
  if (!segDef) return path;

  if (fieldStr === undefined) return segDef.desc;

  const fieldIdx = parseInt(fieldStr, 10) - 1;
  const fieldDef = segDef.fields?.[fieldIdx];
  if (!fieldDef) return path;

  if (compStr === undefined) return fieldDef.desc;

  // Component / subcomponent labels live in the datatype dictionary (XPN, CX,
  // XAD, XTN, etc.). Resolving them requires a second lookup that we defer to
  // a future iteration; for now annotate the field-level label with the
  // sub-position so the UI shows something more informative than the raw path.
  if (subStr === undefined) {
    return `${fieldDef.desc} — component ${compStr}`;
  }
  return `${fieldDef.desc} — component ${compStr}, subcomponent ${subStr}`;
}

/** Read MSH-12 from a parsed HL7 v2 message to determine the message version. */
export function detectVersion(mshLine: string | undefined): string | undefined {
  if (!mshLine) return undefined;
  // MSH|^~\&|...|...|...|...|...|...|...|...|...|VERSION_ID|...
  // Field 12 is VERSION_ID.
  const fields = mshLine.split("|");
  const versionField = fields[11];
  if (!versionField) return undefined;
  // VERSION_ID can be a simple version string or a composite VID type
  // (version^international^international-version). Take the first component.
  const primary = versionField.split("^")[0]!.trim();
  return primary || undefined;
}
