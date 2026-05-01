import { describe, it, expect } from "vitest";
import {
  DEFAULT_DICOM_SR_RULES,
  DEFAULT_DICOM_SR_RULE_PACK,
} from "../../src/dicom/rules.js";

const TAG_FORMAT = /^\([0-9A-F]{4},[0-9A-F]{4}\)$/;
const VR_FORMAT = /^[A-Z]{2}$/;
const RULE_ID_FORMAT = /^dicom-sr\/[a-z0-9-]+$/;
const ALLOWED_RETAIN_PROFILES = new Set(["dates", "uids", "device-ids"]);

describe("DEFAULT_DICOM_SR_RULES — structural invariants", () => {
  it("has at least 50 rules (the SR header surface)", () => {
    // Round number guard: if a future edit accidentally drops a chunk
    // of the table, this catches the regression.
    expect(DEFAULT_DICOM_SR_RULES.length).toBeGreaterThanOrEqual(50);
  });

  it("every tag is formatted as `(GGGG,EEEE)` with uppercase hex", () => {
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(r.tag).toMatch(TAG_FORMAT);
    }
  });

  it("every VR is a 2-letter uppercase code", () => {
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(r.vr).toMatch(VR_FORMAT);
    }
  });

  it("every rule id is in the `dicom-sr/<slug>` namespace", () => {
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(r.rule).toMatch(RULE_ID_FORMAT);
    }
  });

  it("has no duplicate tags", () => {
    const seen = new Set<string>();
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(seen.has(r.tag)).toBe(false);
      seen.add(r.tag);
    }
  });

  it("has no duplicate rule ids", () => {
    const seen = new Set<string>();
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(seen.has(r.rule)).toBe(false);
      seen.add(r.rule);
    }
  });

  it("every retainable value is one of dates/uids/device-ids", () => {
    for (const r of DEFAULT_DICOM_SR_RULES) {
      if (r.retainable !== undefined) {
        expect(ALLOWED_RETAIN_PROFILES.has(r.retainable)).toBe(true);
      }
    }
  });

  it("every name is non-empty and human-readable (no rule-id-style slugs)", () => {
    for (const r of DEFAULT_DICOM_SR_RULES) {
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.name).not.toMatch(/^dicom-/);
    }
  });
});

describe("DEFAULT_DICOM_SR_RULES — semantic spot-checks", () => {
  function findRule(tag: string) {
    const r = DEFAULT_DICOM_SR_RULES.find((x) => x.tag === tag);
    expect(r, `expected a rule for tag ${tag}`).toBeDefined();
    return r!;
  }

  it("PatientName (0010,0010) substitutes a fake name", () => {
    const r = findRule("(0010,0010)");
    expect(r.category).toBe("name");
    expect(r.strategy).toBe("substitute");
    expect(r.vr).toBe("PN");
    expect(r.retainable).toBeUndefined();
  });

  it("PatientID (0010,0020) substitutes a fake id", () => {
    const r = findRule("(0010,0020)");
    expect(r.category).toBe("id");
    expect(r.strategy).toBe("substitute");
  });

  it("PatientBirthDate (0010,0030) is a date and gated by the dates retain profile", () => {
    const r = findRule("(0010,0030)");
    expect(r.category).toBe("date");
    expect(r.strategy).toBe("scrub");
    expect(r.retainable).toBe("dates");
  });

  it("StudyInstanceUID (0020,000D) substitutes a UID and is gated by the uids retain profile", () => {
    const r = findRule("(0020,000D)");
    expect(r.vr).toBe("UI");
    expect(r.strategy).toBe("substitute");
    expect(r.retainable).toBe("uids");
  });

  it("Manufacturer (0008,0070) is scrubbed and gated by device-ids", () => {
    const r = findRule("(0008,0070)");
    expect(r.category).toBe("device-id");
    expect(r.strategy).toBe("scrub");
    expect(r.retainable).toBe("device-ids");
  });

  it("PatientComments (0010,4000) is removed (free-text)", () => {
    const r = findRule("(0010,4000)");
    expect(r.category).toBe("free-text");
    expect(r.strategy).toBe("remove");
  });

  it("ReferringPhysicianName (0008,0090) substitutes a fake name", () => {
    const r = findRule("(0008,0090)");
    expect(r.category).toBe("name");
    expect(r.strategy).toBe("substitute");
    expect(r.vr).toBe("PN");
  });

  it("AccessionNumber (0008,0050) substitutes a fake id (not retainable)", () => {
    const r = findRule("(0008,0050)");
    expect(r.category).toBe("id");
    expect(r.strategy).toBe("substitute");
    expect(r.retainable).toBeUndefined();
  });

  it("InstitutionAddress (0008,0081) is scrubbed as an address (gated by device-ids)", () => {
    const r = findRule("(0008,0081)");
    expect(r.category).toBe("address");
    expect(r.strategy).toBe("scrub");
    expect(r.retainable).toBe("device-ids");
  });

  it("VerifyingObserverName (0040,A075) substitutes a fake name", () => {
    const r = findRule("(0040,A075)");
    expect(r.category).toBe("name");
    expect(r.strategy).toBe("substitute");
    expect(r.vr).toBe("PN");
  });

  it("AdmittingDiagnosesDescription (0008,1080) is removed", () => {
    const r = findRule("(0008,1080)");
    expect(r.category).toBe("free-text");
    expect(r.strategy).toBe("remove");
  });

  it("does not include K-action tags like PatientSex (0010,0040), PatientAge (0010,1010), Modality (0008,0060), SOPClassUID (0008,0016), or TransferSyntaxUID (0002,0010)", () => {
    const tags = new Set(DEFAULT_DICOM_SR_RULES.map((r) => r.tag));
    expect(tags.has("(0010,0040)")).toBe(false); // PatientSex
    expect(tags.has("(0010,1010)")).toBe(false); // PatientAge
    expect(tags.has("(0008,0060)")).toBe(false); // Modality
    expect(tags.has("(0008,0016)")).toBe(false); // SOPClassUID
    expect(tags.has("(0002,0010)")).toBe(false); // TransferSyntaxUID
  });

  it("does not include ContentSequence (0040,A730) — preserved verbatim", () => {
    const tags = new Set(DEFAULT_DICOM_SR_RULES.map((r) => r.tag));
    expect(tags.has("(0040,A730)")).toBe(false);
  });
});

describe("DEFAULT_DICOM_SR_RULE_PACK", () => {
  it("wraps DEFAULT_DICOM_SR_RULES", () => {
    expect(DEFAULT_DICOM_SR_RULE_PACK.rules).toBe(DEFAULT_DICOM_SR_RULES);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(DEFAULT_DICOM_SR_RULE_PACK)).toBe(true);
  });
});
