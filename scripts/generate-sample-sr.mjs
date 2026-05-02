#!/usr/bin/env node
// Generate a synthetic Basic Text SR DICOM file for runtime smoke-testing
// the DicomView. Produces `samples/sample-sr.dcm` with PHI populated in
// most rule-pack-targeted header tags (PatientName, PatientID, DOB, address,
// phone, comments, accession, referring/performing/operator names,
// manufacturer, institution, station, device serial, study/series UIDs).
//
// Output is gitignored. All values are obviously synthetic.
//
// Run from the project root: `npm run sample:sr`

import dcmjs from "dcmjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const { DicomDict, DicomMetaDictionary } = dcmjs.data;

const SR_BASIC_TEXT = "1.2.840.10008.5.1.4.1.1.88.11";
const EXPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";

const sopInstanceUid = DicomMetaDictionary.uid();
const studyUid = DicomMetaDictionary.uid();
const seriesUid = DicomMetaDictionary.uid();

const meta = {
  "00020010": { vr: "UI", Value: [EXPLICIT_VR_LITTLE_ENDIAN] },
  "00020002": { vr: "UI", Value: [SR_BASIC_TEXT] },
  "00020003": { vr: "UI", Value: [sopInstanceUid] },
  "00020012": { vr: "UI", Value: ["1.2.840.113619.6.354"] },
  "00020013": { vr: "SH", Value: ["paste7-sample"] },
};

const dict = {
  "00080005": { vr: "CS", Value: ["ISO_IR 100"] },
  "00080012": { vr: "DA", Value: ["20240315"] },
  "00080013": { vr: "TM", Value: ["103000"] },
  "00080016": { vr: "UI", Value: [SR_BASIC_TEXT] },
  "00080018": { vr: "UI", Value: [sopInstanceUid] },
  "00080020": { vr: "DA", Value: ["20240315"] },
  "00080023": { vr: "DA", Value: ["20240315"] },
  "00080030": { vr: "TM", Value: ["103000"] },
  "00080050": { vr: "SH", Value: ["FAKE-ACC-789456"] },
  "00080060": { vr: "CS", Value: ["SR"] },
  "00080070": { vr: "LO", Value: ["ACME Imaging Inc"] },
  "00080080": { vr: "LO", Value: ["St. Examplevania Hospital"] },
  "00080081": { vr: "ST", Value: ["456 Fake Hospital Rd, Examplevania, FL"] },
  "00080090": { vr: "PN", Value: [{ Alphabetic: "REFER^DOCTOR^MD" }] },
  "00081010": { vr: "SH", Value: ["FAKE-WORKSTATION-01"] },
  "00081030": { vr: "LO", Value: ["Cardiology consultation"] },
  "00081050": { vr: "PN", Value: [{ Alphabetic: "PERFORM^DOCTOR^MD" }] },
  "00081070": { vr: "PN", Value: [{ Alphabetic: "TECH^OPERATOR" }] },
  "00081090": { vr: "LO", Value: ["FakeReporter v3.2.1"] },
  "00100010": { vr: "PN", Value: [{ Alphabetic: "FAKE^PATIENT^A" }] },
  "00100020": { vr: "LO", Value: ["MRN-FAKE-789456"] },
  "00100021": { vr: "LO", Value: ["FAKE-HEALTH-SYSTEM"] },
  "00100030": { vr: "DA", Value: ["19850412"] },
  "00100040": { vr: "CS", Value: ["F"] },
  "00101040": { vr: "LO", Value: ["123 Fake Street, Orlando, FL 32801"] },
  "00102154": { vr: "SH", Value: ["(407) 555-0123"] },
  "00104000": { vr: "LT", Value: ["History of CHF, no known drug allergies."] },
  "00181000": { vr: "LO", Value: ["FAKE-SERIAL-XYZ-123"] },
  "0020000D": { vr: "UI", Value: [studyUid] },
  "0020000E": { vr: "UI", Value: [seriesUid] },
  "00200010": { vr: "SH", Value: ["FAKE-STUDY-001"] },
  "00200011": { vr: "IS", Value: ["1"] },
  "00200013": { vr: "IS", Value: ["1"] },
  "0040A027": { vr: "LO", Value: ["St. Examplevania Hospital - Radiology"] },
  "0040A032": { vr: "DT", Value: ["20240315103000"] },
  "0040A040": { vr: "CS", Value: ["CONTAINER"] },
};

const dd = new DicomDict(meta);
dd.dict = dict;

const outDir = resolve(REPO_ROOT, "samples");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "sample-sr.dcm");
const bytes = new Uint8Array(dd.write());
writeFileSync(outPath, bytes);

console.log(`wrote ${outPath}`);
console.log(`  ${bytes.byteLength} bytes, SOP Class: Basic Text SR (${SR_BASIC_TEXT})`);
console.log(`  Drop into the DICOM workflow to smoke-test redact-and-export.`);
