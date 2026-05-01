// DICOM SR header rule pack — paste7 Phase 3 step 1.
//
// Subset of DICOM PS 3.15 Basic Application Confidentiality Profile (BACP)
// filtered to tags that appear in SR header modules (File Meta + SOP
// Common + Patient + Patient Study + General Study + General Series +
// SR Document Series + General Equipment + SR Document General).
// The full BACP has ~250 tags; we cover ~70 — the slice that's actually
// reachable in SR objects after the 2026-05-01 scope narrowing.
//
// PS 3.15 action codes mapped to paste7 strategies:
//   D → "substitute" (replace with non-zero-length dummy value)
//   Z → "scrub" (replace with zero-length value)
//   X → "remove" (remove the tag entirely)
//   U → "substitute" (replace with a re-mapped non-zero-length UID)
//   K → not in this pack (preserved verbatim)
//
// Sub-profile gating per PS 3.15 Annex E:
//   retainable: "dates"      → Retain Longitudinal With Full Dates (113107)
//   retainable: "uids"       → Retain UIDs (113108)
//   retainable: "device-ids" → Retain Device Identity (113109)
//
// ContentSequence (0040,A730) and AcquisitionContext (0040,0555) are
// preserved verbatim by the walker — out of redaction scope, not in
// this pack.

import type { DicomRule, DicomRulePack } from "./types.js";

/**
 * Default rule pack for SR headers. The walker applies these rules in
 * the order listed, but order is not semantically significant — each
 * tag has at most one rule.
 */
export const DEFAULT_DICOM_SR_RULES: ReadonlyArray<DicomRule> = [
  // -- File Meta (group 0002) ------------------------------------------------
  // FileMetaInformationGroupLength (0002,0000), FileMetaInformationVersion
  // (0002,0001), TransferSyntaxUID (0002,0010), ImplementationClassUID
  // (0002,0012), ImplementationVersionName (0002,0013) — all K, preserved.
  // MediaStorageSOPClassUID (0002,0002) — K, must match SOP Class.
  {
    tag: "(0002,0003)",
    vr: "UI",
    name: "Media Storage SOP Instance UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/file-meta-sop-instance-uid",
    retainable: "uids",
  },
  {
    tag: "(0002,0016)",
    vr: "AE",
    name: "Source Application Entity Title",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/file-meta-source-ae-title",
    retainable: "device-ids",
  },
  {
    tag: "(0002,0017)",
    vr: "AE",
    name: "Sending Application Entity Title",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/file-meta-sending-ae-title",
    retainable: "device-ids",
  },
  {
    tag: "(0002,0018)",
    vr: "AE",
    name: "Receiving Application Entity Title",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/file-meta-receiving-ae-title",
    retainable: "device-ids",
  },

  // -- SOP Common + Instance creation (group 0008) ---------------------------
  {
    tag: "(0008,0012)",
    vr: "DA",
    name: "Instance Creation Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/instance-creation-date",
    retainable: "dates",
  },
  {
    tag: "(0008,0013)",
    vr: "TM",
    name: "Instance Creation Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/instance-creation-time",
    retainable: "dates",
  },
  {
    tag: "(0008,0014)",
    vr: "UI",
    name: "Instance Creator UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/instance-creator-uid",
    retainable: "uids",
  },
  // SOPClassUID (0008,0016) — K, canonical SOP Class identifier.
  {
    tag: "(0008,0018)",
    vr: "UI",
    name: "SOP Instance UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/sop-instance-uid",
    retainable: "uids",
  },

  // -- General Study (group 0008/0020) ---------------------------------------
  {
    tag: "(0008,0020)",
    vr: "DA",
    name: "Study Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/study-date",
    retainable: "dates",
  },
  {
    tag: "(0008,0021)",
    vr: "DA",
    name: "Series Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/series-date",
    retainable: "dates",
  },
  {
    tag: "(0008,0022)",
    vr: "DA",
    name: "Acquisition Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/acquisition-date",
    retainable: "dates",
  },
  {
    tag: "(0008,0023)",
    vr: "DA",
    name: "Content Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/content-date",
    retainable: "dates",
  },
  {
    tag: "(0008,002A)",
    vr: "DT",
    name: "Acquisition DateTime",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/acquisition-datetime",
    retainable: "dates",
  },
  {
    tag: "(0008,0030)",
    vr: "TM",
    name: "Study Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/study-time",
    retainable: "dates",
  },
  {
    tag: "(0008,0031)",
    vr: "TM",
    name: "Series Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/series-time",
    retainable: "dates",
  },
  {
    tag: "(0008,0032)",
    vr: "TM",
    name: "Acquisition Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/acquisition-time",
    retainable: "dates",
  },
  {
    tag: "(0008,0033)",
    vr: "TM",
    name: "Content Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/content-time",
    retainable: "dates",
  },
  {
    tag: "(0008,0050)",
    vr: "SH",
    name: "Accession Number",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/accession-number",
  },
  {
    tag: "(0008,0080)",
    vr: "LO",
    name: "Institution Name",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/institution-name",
    retainable: "device-ids",
  },
  {
    tag: "(0008,0081)",
    vr: "ST",
    name: "Institution Address",
    category: "address",
    strategy: "scrub",
    rule: "dicom-sr/institution-address",
    retainable: "device-ids",
  },
  {
    tag: "(0008,0090)",
    vr: "PN",
    name: "Referring Physician's Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/referring-physician-name",
  },
  {
    tag: "(0008,0092)",
    vr: "ST",
    name: "Referring Physician's Address",
    category: "address",
    strategy: "scrub",
    rule: "dicom-sr/referring-physician-address",
  },
  {
    tag: "(0008,0094)",
    vr: "SH",
    name: "Referring Physician's Telephone Numbers",
    category: "phone",
    strategy: "scrub",
    rule: "dicom-sr/referring-physician-phone",
  },
  {
    tag: "(0008,0096)",
    vr: "SQ",
    name: "Referring Physician Identification Sequence",
    category: "name",
    strategy: "remove",
    rule: "dicom-sr/referring-physician-id-sequence",
  },
  {
    tag: "(0008,1010)",
    vr: "SH",
    name: "Station Name",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/station-name",
    retainable: "device-ids",
  },
  {
    tag: "(0008,1030)",
    vr: "LO",
    name: "Study Description",
    category: "free-text",
    strategy: "scrub",
    rule: "dicom-sr/study-description",
  },
  {
    tag: "(0008,1040)",
    vr: "LO",
    name: "Institutional Department Name",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/institutional-department-name",
    retainable: "device-ids",
  },
  {
    tag: "(0008,1048)",
    vr: "PN",
    name: "Physician(s) of Record",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/physicians-of-record",
  },
  {
    tag: "(0008,1050)",
    vr: "PN",
    name: "Performing Physician's Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/performing-physician-name",
  },
  {
    tag: "(0008,1060)",
    vr: "PN",
    name: "Name of Physician(s) Reading Study",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/reading-physician-name",
  },
  {
    tag: "(0008,1070)",
    vr: "PN",
    name: "Operators' Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/operators-name",
  },
  {
    tag: "(0008,1080)",
    vr: "LO",
    name: "Admitting Diagnoses Description",
    category: "free-text",
    strategy: "remove",
    rule: "dicom-sr/admitting-diagnoses",
  },
  {
    tag: "(0008,1090)",
    vr: "LO",
    name: "Manufacturer's Model Name",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/manufacturer-model-name",
    retainable: "device-ids",
  },
  {
    tag: "(0008,103E)",
    vr: "LO",
    name: "Series Description",
    category: "free-text",
    strategy: "scrub",
    rule: "dicom-sr/series-description",
  },
  {
    tag: "(0008,0070)",
    vr: "LO",
    name: "Manufacturer",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/manufacturer",
    retainable: "device-ids",
  },

  // -- Patient (group 0010) --------------------------------------------------
  {
    tag: "(0010,0010)",
    vr: "PN",
    name: "Patient's Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/patient-name",
  },
  {
    tag: "(0010,0020)",
    vr: "LO",
    name: "Patient ID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/patient-id",
  },
  {
    tag: "(0010,0021)",
    vr: "LO",
    name: "Issuer of Patient ID",
    category: "id",
    strategy: "scrub",
    rule: "dicom-sr/issuer-of-patient-id",
  },
  {
    tag: "(0010,0030)",
    vr: "DA",
    name: "Patient's Birth Date",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/patient-birth-date",
    retainable: "dates",
  },
  {
    tag: "(0010,0032)",
    vr: "TM",
    name: "Patient's Birth Time",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/patient-birth-time",
    retainable: "dates",
  },
  // PatientSex (0010,0040) — K per BACP. Retained verbatim.
  {
    tag: "(0010,1000)",
    vr: "LO",
    name: "Other Patient IDs",
    category: "id",
    strategy: "remove",
    rule: "dicom-sr/other-patient-ids",
  },
  {
    tag: "(0010,1001)",
    vr: "PN",
    name: "Other Patient Names",
    category: "name",
    strategy: "remove",
    rule: "dicom-sr/other-patient-names",
  },
  {
    tag: "(0010,1002)",
    vr: "SQ",
    name: "Other Patient IDs Sequence",
    category: "id",
    strategy: "remove",
    rule: "dicom-sr/other-patient-ids-sequence",
  },
  {
    tag: "(0010,1005)",
    vr: "PN",
    name: "Patient's Birth Name",
    category: "name",
    strategy: "remove",
    rule: "dicom-sr/patient-birth-name",
  },
  // PatientAge (0010,1010), PatientSize (0010,1020), PatientWeight
  // (0010,1030) — K per BACP, retained verbatim.
  {
    tag: "(0010,1040)",
    vr: "LO",
    name: "Patient's Address",
    category: "address",
    strategy: "scrub",
    rule: "dicom-sr/patient-address",
  },
  {
    tag: "(0010,1060)",
    vr: "PN",
    name: "Patient's Mother's Birth Name",
    category: "name",
    strategy: "remove",
    rule: "dicom-sr/patient-mother-birth-name",
  },
  {
    tag: "(0010,1090)",
    vr: "LO",
    name: "Medical Record Locator",
    category: "id",
    strategy: "scrub",
    rule: "dicom-sr/medical-record-locator",
  },
  {
    tag: "(0010,2154)",
    vr: "SH",
    name: "Patient's Telephone Numbers",
    category: "phone",
    strategy: "scrub",
    rule: "dicom-sr/patient-phone-numbers",
  },
  {
    tag: "(0010,2160)",
    vr: "SH",
    name: "Ethnic Group",
    category: "free-text",
    strategy: "scrub",
    rule: "dicom-sr/ethnic-group",
  },
  {
    tag: "(0010,2180)",
    vr: "SH",
    name: "Occupation",
    category: "free-text",
    strategy: "scrub",
    rule: "dicom-sr/occupation",
  },
  {
    tag: "(0010,21B0)",
    vr: "LT",
    name: "Additional Patient History",
    category: "free-text",
    strategy: "remove",
    rule: "dicom-sr/additional-patient-history",
  },
  {
    tag: "(0010,4000)",
    vr: "LT",
    name: "Patient Comments",
    category: "free-text",
    strategy: "remove",
    rule: "dicom-sr/patient-comments",
  },

  // -- General Equipment (group 0018) ----------------------------------------
  {
    tag: "(0018,1000)",
    vr: "LO",
    name: "Device Serial Number",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/device-serial-number",
    retainable: "device-ids",
  },
  // SoftwareVersions (0018,1020) — K per BACP. Retained.

  // -- General Study + Series UIDs (group 0020) ------------------------------
  {
    tag: "(0020,000D)",
    vr: "UI",
    name: "Study Instance UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/study-instance-uid",
    retainable: "uids",
  },
  {
    tag: "(0020,000E)",
    vr: "UI",
    name: "Series Instance UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/series-instance-uid",
    retainable: "uids",
  },
  {
    tag: "(0020,0010)",
    vr: "SH",
    name: "Study ID",
    category: "id",
    strategy: "scrub",
    rule: "dicom-sr/study-id",
  },
  // SeriesNumber (0020,0011), InstanceNumber (0020,0013) — K per BACP.
  {
    tag: "(0020,0052)",
    vr: "UI",
    name: "Frame of Reference UID",
    category: "id",
    strategy: "substitute",
    rule: "dicom-sr/frame-of-reference-uid",
    retainable: "uids",
  },
  {
    tag: "(0020,4000)",
    vr: "LT",
    name: "Image Comments",
    category: "free-text",
    strategy: "remove",
    rule: "dicom-sr/image-comments",
  },

  // -- SR Document General + Verifying Observer (group 0040) -----------------
  {
    tag: "(0040,A027)",
    vr: "LO",
    name: "Verifying Organization",
    category: "device-id",
    strategy: "scrub",
    rule: "dicom-sr/verifying-organization",
    retainable: "device-ids",
  },
  {
    tag: "(0040,A030)",
    vr: "DT",
    name: "Verification DateTime",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/verification-datetime",
    retainable: "dates",
  },
  {
    tag: "(0040,A032)",
    vr: "DT",
    name: "Observation DateTime",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/observation-datetime",
    retainable: "dates",
  },
  {
    tag: "(0040,A073)",
    vr: "SQ",
    name: "Verifying Observer Sequence",
    category: "name",
    strategy: "scrub",
    rule: "dicom-sr/verifying-observer-sequence",
  },
  {
    tag: "(0040,A075)",
    vr: "PN",
    name: "Verifying Observer Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/verifying-observer-name",
  },
  {
    tag: "(0040,A078)",
    vr: "SQ",
    name: "Author Observer Sequence",
    category: "name",
    strategy: "scrub",
    rule: "dicom-sr/author-observer-sequence",
  },
  {
    tag: "(0040,A082)",
    vr: "DT",
    name: "Participation DateTime",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/participation-datetime",
    retainable: "dates",
  },
  {
    tag: "(0040,A088)",
    vr: "SQ",
    name: "Verifying Observer Identification Code Sequence",
    category: "id",
    strategy: "remove",
    rule: "dicom-sr/verifying-observer-id-code-sequence",
  },
  {
    tag: "(0040,A123)",
    vr: "PN",
    name: "Person Name",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/sr-person-name",
  },
  {
    tag: "(0040,A192)",
    vr: "DT",
    name: "Observation DateTime of Recording",
    category: "date",
    strategy: "scrub",
    rule: "dicom-sr/observation-datetime-of-recording",
    retainable: "dates",
  },
  {
    tag: "(0040,A352)",
    vr: "PN",
    name: "Verbal Source (Observer)",
    category: "name",
    strategy: "substitute",
    rule: "dicom-sr/verbal-source",
  },
  // ContentSequence (0040,A730) and AcquisitionContext (0040,0555) preserved
  // verbatim by the walker — out of redaction scope, no rule entries here.
];

export const DEFAULT_DICOM_SR_RULE_PACK: DicomRulePack = Object.freeze({
  rules: DEFAULT_DICOM_SR_RULES,
});
