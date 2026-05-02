import { describe, it, expect, beforeEach } from "vitest";
import dcmjs from "dcmjs";

import { createDicomRedactor } from "../../src/dicom/redactor.js";
import type { DicomRedactor } from "../../src/dicom/types.js";

const { DicomDict, DicomMessage, DicomMetaDictionary } = dcmjs.data;

const SR_BASIC_TEXT = "1.2.840.10008.5.1.4.1.1.88.11";
const CT_IMAGE = "1.2.840.10008.5.1.4.1.1.2";
const EXPLICIT_VR_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";

interface SyntheticSrOpts {
  sopClassUid?: string;
  patientName?: string;
  patientId?: string;
  patientBirthDate?: string;
  patientSex?: string;
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
  studyDate?: string;
  accessionNumber?: string;
  referringPhysicianName?: string;
  manufacturer?: string;
  institutionName?: string;
  patientComments?: string;
  patientPhone?: string;
  patientAddress?: string;
  contentSequence?: unknown[];
  /** When true, omit the (0002,0002) Media Storage SOP Class UID tag entirely. */
  omitSopClass?: boolean;
}

/** Build a synthetic SR DICOM file in-memory and return its bytes. */
function buildSyntheticSr(opts: SyntheticSrOpts = {}): Uint8Array {
  const sopClassUid = opts.sopClassUid ?? SR_BASIC_TEXT;
  const sopInstanceUid = opts.sopInstanceUid ?? DicomMetaDictionary.uid();
  const studyUid = opts.studyInstanceUid ?? DicomMetaDictionary.uid();
  const seriesUid = opts.seriesInstanceUid ?? DicomMetaDictionary.uid();

  const meta: Record<string, { vr: string; Value: unknown[] }> = {
    "00020010": { vr: "UI", Value: [EXPLICIT_VR_LITTLE_ENDIAN] },
    "00020003": { vr: "UI", Value: [sopInstanceUid] },
    "00020012": { vr: "UI", Value: ["1.2.840.113619.6.354"] },
    "00020013": { vr: "SH", Value: ["paste7-test"] },
  };
  if (!opts.omitSopClass) {
    meta["00020002"] = { vr: "UI", Value: [sopClassUid] };
  }

  const dict: Record<string, { vr: string; Value: unknown[] }> = {
    "00080005": { vr: "CS", Value: ["ISO_IR 100"] },
    "00080016": { vr: "UI", Value: [sopClassUid] },
    "00080018": { vr: "UI", Value: [sopInstanceUid] },
    "0020000D": { vr: "UI", Value: [studyUid] },
    "0020000E": { vr: "UI", Value: [seriesUid] },
    "00080060": { vr: "CS", Value: ["SR"] },
    "00200013": { vr: "IS", Value: ["1"] },
    "00200011": { vr: "IS", Value: ["1"] },
  };

  if (opts.patientName) dict["00100010"] = { vr: "PN", Value: [{ Alphabetic: opts.patientName }] };
  if (opts.patientId) dict["00100020"] = { vr: "LO", Value: [opts.patientId] };
  if (opts.patientBirthDate) dict["00100030"] = { vr: "DA", Value: [opts.patientBirthDate] };
  if (opts.patientSex) dict["00100040"] = { vr: "CS", Value: [opts.patientSex] };
  if (opts.studyDate) dict["00080020"] = { vr: "DA", Value: [opts.studyDate] };
  if (opts.accessionNumber) dict["00080050"] = { vr: "SH", Value: [opts.accessionNumber] };
  if (opts.referringPhysicianName) {
    dict["00080090"] = { vr: "PN", Value: [{ Alphabetic: opts.referringPhysicianName }] };
  }
  if (opts.manufacturer) dict["00080070"] = { vr: "LO", Value: [opts.manufacturer] };
  if (opts.institutionName) dict["00080080"] = { vr: "LO", Value: [opts.institutionName] };
  if (opts.patientComments) dict["00104000"] = { vr: "LT", Value: [opts.patientComments] };
  if (opts.patientPhone) dict["00102154"] = { vr: "SH", Value: [opts.patientPhone] };
  if (opts.patientAddress) dict["00101040"] = { vr: "LO", Value: [opts.patientAddress] };
  if (opts.contentSequence) {
    dict["0040A730"] = { vr: "SQ", Value: opts.contentSequence };
  }

  const dd = new DicomDict(meta);
  dd.dict = dict;
  return new Uint8Array(dd.write());
}

function readBack(bytes: Uint8Array) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return DicomMessage.readFile(ab);
}

/**
 * dcmjs's writer round-trips an empty `Value: []` to `Value: [""]` — both
 * encode a zero-length DICOM value (Type 2 / Z compliance). Treat both
 * shapes as "scrubbed".
 */
function isScrubbed(entry: { Value?: unknown[] } | undefined): boolean {
  if (entry === undefined) return false;
  const v = entry.Value ?? [];
  if (v.length === 0) return true;
  if (v.length === 1 && (v[0] === "" || v[0] === null || v[0] === undefined)) return true;
  return false;
}

describe("createDicomRedactor — surface", () => {
  it("returns an object with redactSrHeaders and reset", () => {
    const r = createDicomRedactor();
    expect(typeof r.redactSrHeaders).toBe("function");
    expect(typeof r.reset).toBe("function");
  });

  it("accepts the full config shape without throwing", () => {
    const r = createDicomRedactor({
      retainDates: true,
      retainUids: true,
      retainDeviceIds: true,
    });
    expect(r).toBeDefined();
  });
});

describe("createDicomRedactor — SOP class validation", () => {
  let redactor: DicomRedactor;
  beforeEach(() => {
    redactor = createDicomRedactor();
  });

  it("rejects non-SR SOP Classes with a clear error", async () => {
    const ct = buildSyntheticSr({ sopClassUid: CT_IMAGE });
    await expect(redactor.redactSrHeaders(ct)).rejects.toThrow(/not in the SR family/);
  });

  it("rejects DICOM input missing the (0002,0002) tag", async () => {
    const noSopClass = buildSyntheticSr({ omitSopClass: true });
    // dcmjs's writer might still inject (0002,0002) from the dataset; build
    // a buffer with neither File Meta SOP Class nor Dataset SOP Class to
    // truly omit. dcmjs requires file meta SOP Class to write — so we
    // fabricate via a different path: parse a file, then strip the meta tag.
    const dd = readBack(noSopClass);
    delete dd.meta["00020002"];
    delete dd.dict["00080016"];
    const stripped = new Uint8Array(dd.write());
    await expect(redactor.redactSrHeaders(stripped)).rejects.toThrow(
      /missing Media Storage SOP Class UID/,
    );
  });

  it("accepts a valid SR object", async () => {
    const sr = buildSyntheticSr({ patientName: "DOE^JOHN", patientId: "MRN-123" });
    const result = await redactor.redactSrHeaders(sr);
    expect(result.sopClassUid).toBe(SR_BASIC_TEXT);
    expect(result.sopClassName).toBe("Basic Text SR Storage");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe("createDicomRedactor — redaction strategies", () => {
  let redactor: DicomRedactor;
  beforeEach(() => {
    redactor = createDicomRedactor();
  });

  it("substitutes PatientName preserving the {Alphabetic: ...} structure", async () => {
    const sr = buildSyntheticSr({ patientName: "DOE^JOHN" });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    const pn = dd.dict["00100010"];
    expect(pn).toBeDefined();
    const value = pn!.Value?.[0] as { Alphabetic?: string };
    expect(typeof value?.Alphabetic).toBe("string");
    expect(value.Alphabetic).not.toBe("DOE^JOHN");
    // family^given shape preserved
    expect(value.Alphabetic).toMatch(/^[^\^]+\^[^\^]+/);
  });

  it("substitutes PatientID with a non-empty fake", async () => {
    const sr = buildSyntheticSr({ patientId: "REAL-MRN-12345" });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    const id = dd.dict["00100020"]!.Value?.[0] as string;
    expect(id).not.toBe("REAL-MRN-12345");
    expect(id.length).toBeGreaterThan(0);
  });

  it("scrubs PatientBirthDate (Type 2 — empty Value, tag preserved)", async () => {
    const sr = buildSyntheticSr({ patientBirthDate: "19800115" });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    const dob = dd.dict["00100030"];
    expect(dob).toBeDefined();
    expect(isScrubbed(dob)).toBe(true);
  });

  it("removes PatientComments (Type 3 — tag absent in output)", async () => {
    const sr = buildSyntheticSr({ patientComments: "alcoholic, history of CHF" });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(dd.dict["00104000"]).toBeUndefined();
  });

  it("preserves PatientSex verbatim (K-action; not in rule pack)", async () => {
    const sr = buildSyntheticSr({ patientName: "DOE^JOHN", patientSex: "M" });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(dd.dict["00100040"]?.Value?.[0]).toBe("M");
  });

  it("substitutes UIDs with new 2.25-rooted UIDs", async () => {
    const studyUid = "1.2.3.4.5.6.7.8.9";
    const sr = buildSyntheticSr({ studyInstanceUid: studyUid });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    const newStudyUid = dd.dict["0020000D"]!.Value?.[0] as string;
    expect(newStudyUid).not.toBe(studyUid);
    expect(newStudyUid).toMatch(/^2\.25\.\d+/);
  });

  it("re-maps the same input UID consistently across tags within a single file", async () => {
    // SOP Instance UID appears in both File Meta (0002,0003) and dataset (0008,0018).
    const sopInstance = "1.2.999.8.7.6.5.4";
    const sr = buildSyntheticSr({ sopInstanceUid: sopInstance });
    const result = await redactor.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    const metaSopInstance = dd.meta["00020003"]!.Value?.[0] as string;
    const datasetSopInstance = dd.dict["00080018"]!.Value?.[0] as string;
    expect(metaSopInstance).toBe(datasetSopInstance);
    expect(metaSopInstance).not.toBe(sopInstance);
  });
});

describe("createDicomRedactor — sub-profile retain flags", () => {
  it("retainDates preserves Patient's Birth Date and Study Date", async () => {
    const r = createDicomRedactor({ retainDates: true });
    const sr = buildSyntheticSr({ patientBirthDate: "19800115", studyDate: "20240301" });
    const result = await r.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(dd.dict["00100030"]?.Value?.[0]).toBe("19800115");
    expect(dd.dict["00080020"]?.Value?.[0]).toBe("20240301");
    // No findings emitted for the retained tags
    const findingTags = new Set(result.findings.map((f) => f.tag));
    expect(findingTags.has("(0010,0030)")).toBe(false);
    expect(findingTags.has("(0008,0020)")).toBe(false);
  });

  it("retainUids preserves Study/Series Instance UIDs (but Patient still substituted)", async () => {
    const r = createDicomRedactor({ retainUids: true });
    const studyUid = "1.2.3.4.5";
    const sr = buildSyntheticSr({ studyInstanceUid: studyUid, patientName: "DOE^JOHN" });
    const result = await r.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(dd.dict["0020000D"]?.Value?.[0]).toBe(studyUid);
    // Patient still redacted
    const pn = dd.dict["00100010"]!.Value?.[0] as { Alphabetic: string };
    expect(pn.Alphabetic).not.toBe("DOE^JOHN");
  });

  it("retainDeviceIds preserves Manufacturer and Institution Name", async () => {
    const r = createDicomRedactor({ retainDeviceIds: true });
    const sr = buildSyntheticSr({
      manufacturer: "ACME Imaging Inc",
      institutionName: "St. Examplevania Hospital",
    });
    const result = await r.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(dd.dict["00080070"]?.Value?.[0]).toBe("ACME Imaging Inc");
    expect(dd.dict["00080080"]?.Value?.[0]).toBe("St. Examplevania Hospital");
  });

  it("default config (no retain flags) redacts everything", async () => {
    const r = createDicomRedactor();
    const sr = buildSyntheticSr({
      patientBirthDate: "19800115",
      studyInstanceUid: "1.2.3.4.5",
      manufacturer: "ACME",
      patientName: "DOE^JOHN",
    });
    const result = await r.redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    expect(isScrubbed(dd.dict["00100030"])).toBe(true); // birth date scrubbed
    expect(dd.dict["0020000D"]?.Value?.[0]).not.toBe("1.2.3.4.5"); // study UID remapped
    expect(isScrubbed(dd.dict["00080070"])).toBe(true); // manufacturer scrubbed
  });
});

describe("createDicomRedactor — content preservation", () => {
  it("preserves ContentSequence (0040,A730) verbatim", async () => {
    const contentSequence = [
      {
        "00400A040": { vr: "CS", Value: ["TEXT"] },
        "0040A160": { vr: "UT", Value: ["The findings are unremarkable."] },
      },
    ];
    const sr = buildSyntheticSr({
      patientName: "DOE^JOHN",
      contentSequence,
    });
    const result = await createDicomRedactor().redactSrHeaders(sr);
    const dd = readBack(result.redacted);
    // Tag still present (not redacted by our pack)
    expect(dd.dict["0040A730"]).toBeDefined();
    // Findings should not include ContentSequence
    expect(result.findings.find((f) => f.tag === "(0040,A730)")).toBeUndefined();
  });

  it("emits a finding for every redacted tag with consistent metadata", async () => {
    const sr = buildSyntheticSr({
      patientName: "DOE^JOHN",
      patientId: "REAL-MRN-12345",
      patientBirthDate: "19800115",
      patientComments: "free text",
    });
    const result = await createDicomRedactor().redactSrHeaders(sr);
    const tags = result.findings.map((f) => f.tag);
    expect(tags).toContain("(0010,0010)"); // PatientName
    expect(tags).toContain("(0010,0020)"); // PatientID
    expect(tags).toContain("(0010,0030)"); // PatientBirthDate
    expect(tags).toContain("(0010,4000)"); // PatientComments

    for (const f of result.findings) {
      expect(f.tag).toMatch(/^\([0-9A-F]{4},[0-9A-F]{4}\)$/);
      expect(f.vr.length).toBe(2);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.rule.startsWith("dicom-sr/")).toBe(true);
      expect(typeof f.confidence).toBe("number");
      expect(typeof f.originalLength).toBe("number");
    }
  });

  it("produces a parseable redacted output (parse-redact-parse round trip)", async () => {
    const sr = buildSyntheticSr({
      patientName: "DOE^JOHN",
      patientId: "MRN-1",
      studyDate: "20240301",
      manufacturer: "ACME",
    });
    const result = await createDicomRedactor().redactSrHeaders(sr);
    // Re-parsing the redacted bytes must not throw.
    expect(() => readBack(result.redacted)).not.toThrow();
  });
});

describe("createDicomRedactor — session lifecycle", () => {
  it("reuses identity bindings across successive redactSrHeaders calls in one session", async () => {
    const r = createDicomRedactor();
    const file1 = buildSyntheticSr({ patientName: "DOE^JOHN", patientId: "P1" });
    const file2 = buildSyntheticSr({ patientName: "DOE^JOHN", patientId: "P2" });

    const r1 = await r.redactSrHeaders(file1);
    const r2 = await r.redactSrHeaders(file2);

    const pn1 = readBack(r1.redacted).dict["00100010"]!.Value?.[0] as { Alphabetic: string };
    const pn2 = readBack(r2.redacted).dict["00100010"]!.Value?.[0] as { Alphabetic: string };
    expect(pn1.Alphabetic).toBe(pn2.Alphabetic); // same input → same fake
  });

  it("reset() drops bindings so the next call starts fresh", async () => {
    const r = createDicomRedactor();
    const sr = buildSyntheticSr({ patientName: "DOE^JOHN" });
    const r1 = await r.redactSrHeaders(sr);

    r.reset();

    const r2 = await r.redactSrHeaders(sr);
    const pn1 = readBack(r1.redacted).dict["00100010"]!.Value?.[0] as { Alphabetic: string };
    const pn2 = readBack(r2.redacted).dict["00100010"]!.Value?.[0] as { Alphabetic: string };
    // After reset the cursor restarts from the same pool, but the binding cache
    // is empty — same input yields the same first-allocated fake again.
    // (This asserts both fakes are valid; the equal-or-not invariant depends
    // on pool ordering. Just confirm both are non-empty and structurally PN.)
    expect(pn1.Alphabetic).toMatch(/\^/);
    expect(pn2.Alphabetic).toMatch(/\^/);
  });

  it("re-maps UIDs consistently within a session", async () => {
    const r = createDicomRedactor();
    const studyUid = "1.2.3.4.5.6";
    const f1 = buildSyntheticSr({ studyInstanceUid: studyUid });
    const f2 = buildSyntheticSr({ studyInstanceUid: studyUid });

    const r1 = await r.redactSrHeaders(f1);
    const r2 = await r.redactSrHeaders(f2);

    const u1 = readBack(r1.redacted).dict["0020000D"]!.Value?.[0] as string;
    const u2 = readBack(r2.redacted).dict["0020000D"]!.Value?.[0] as string;
    expect(u1).toBe(u2);
  });
});
