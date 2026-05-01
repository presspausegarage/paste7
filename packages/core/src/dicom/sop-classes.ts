// DICOM Structured Report SOP Class detection.
//
// paste7 Phase 3 deliberately narrows DICOM scope to the SR family
// (`1.2.840.10008.5.1.4.1.1.88.*`). Non-SR objects (CR, CT, MR, US,
// modality-specific reports, etc.) are rejected at the file-drop
// boundary with a clear error.
//
// Two surfaces:
//   - `isSrSopClass(uid)` — the validator the file-drop UI uses to accept/reject.
//   - `getSrSopClassName(uid)` — name resolution for the header table; returns
//     the standardized SOP Class display name (e.g. "Comprehensive SR").
//
// The validator is a prefix match (forward-compatible with new SR types
// NEMA may add to PS 3.4 later); the name lookup is a finite enumerated
// table covering the SR SOP Classes published in PS 3.4 as of 2026.

/** SR SOP Class UID prefix. All SR Storage SOP Classes share this stem. */
export const SR_SOP_CLASS_PREFIX = "1.2.840.10008.5.1.4.1.1.88.";

interface KnownSrSopClass {
  readonly uid: string;
  readonly name: string;
  /** Marked retired in the standard. Still valid input; names track the standard. */
  readonly retired?: true;
}

/**
 * Known SR SOP Classes from DICOM PS 3.4. New entries can be appended
 * without changing the validator (which is prefix-based). Order is
 * irrelevant — lookup uses a Map.
 */
export const KNOWN_SR_SOP_CLASSES: ReadonlyArray<KnownSrSopClass> = [
  { uid: "1.2.840.10008.5.1.4.1.1.88.1", name: "Text SR Storage - Trial", retired: true },
  { uid: "1.2.840.10008.5.1.4.1.1.88.2", name: "Audio SR Storage - Trial", retired: true },
  { uid: "1.2.840.10008.5.1.4.1.1.88.3", name: "Detail SR Storage - Trial", retired: true },
  { uid: "1.2.840.10008.5.1.4.1.1.88.4", name: "Comprehensive SR Storage - Trial", retired: true },
  { uid: "1.2.840.10008.5.1.4.1.1.88.11", name: "Basic Text SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.22", name: "Enhanced SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.33", name: "Comprehensive SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.34", name: "Comprehensive 3D SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.35", name: "Extensible SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.40", name: "Procedure Log Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.50", name: "Mammography CAD SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.59", name: "Key Object Selection Document Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.65", name: "Chest CAD SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.67", name: "X-Ray Radiation Dose SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.68", name: "Radiopharmaceutical Radiation Dose SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.69", name: "Colon CAD SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.70", name: "Implantation Plan SR Document Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.71", name: "Acquisition Context SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.72", name: "Simplified Adult Echo SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.73", name: "Patient Radiation Dose SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.74", name: "Planned Imaging Agent Administration SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.75", name: "Performed Imaging Agent Administration SR Storage" },
  { uid: "1.2.840.10008.5.1.4.1.1.88.76", name: "Enhanced X-Ray Radiation Dose SR Storage" },
];

const NAME_BY_UID: ReadonlyMap<string, string> = new Map(
  KNOWN_SR_SOP_CLASSES.map((entry) => [entry.uid, entry.name]),
);

// DICOM UID syntax (PS 3.5 § 9): components are dot-separated digit groups,
// each group has no leading zero unless the group is the single digit "0",
// max 64 chars total. We validate shape then prefix-match.
const UID_SHAPE = /^[0-2](?:\.(?:0|[1-9]\d*))+$/;

/**
 * True if the UID is in the SR Storage SOP Class family
 * (`1.2.840.10008.5.1.4.1.1.88.*`). Returns false for empty strings,
 * malformed UIDs, and any UID outside the family.
 *
 * Includes retired SR-Trial classes (`.88.1` through `.88.4`) — pre-2003
 * fixtures still circulate and we redact them on the same rules. Includes
 * Key Object Selection Documents (`.88.59`) and Procedure Logs (`.88.40`),
 * which share the SR header module structure even though they are not
 * "reports" per se.
 */
export function isSrSopClass(uid: string): boolean {
  if (typeof uid !== "string" || uid.length === 0 || uid.length > 64) return false;
  if (!UID_SHAPE.test(uid)) return false;
  if (!uid.startsWith(SR_SOP_CLASS_PREFIX)) return false;
  // Reject empty trailing component: `1.2.840.10008.5.1.4.1.1.88.` would
  // pass the prefix check but the shape regex already rules out trailing
  // dots, so this is belt-and-suspenders.
  return uid.length > SR_SOP_CLASS_PREFIX.length;
}

/**
 * Return the standardized SOP Class name for a known SR UID.
 * Returns `undefined` for unrecognized UIDs (including malformed input
 * and non-SR families). Caller should pair this with `isSrSopClass()`
 * for validation.
 */
export function getSrSopClassName(uid: string): string | undefined {
  if (typeof uid !== "string") return undefined;
  return NAME_BY_UID.get(uid);
}
