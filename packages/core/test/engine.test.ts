import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine.js";
import type { RulePack } from "../src/index.js";

// -----------------------------------------------------------------------------
// Minimal rule packs (full packs ship in Phase 1 step 5)
// -----------------------------------------------------------------------------

const HL7V2_MIN_RULES: RulePack = {
  format: "hl7v2",
  rules: [
    { path: "PID-3", category: "id", rule: "hl7v2/PID-3" },
    { path: "PID-5", category: "name", rule: "hl7v2/PID-5" },
    { path: "PID-7", category: "date", rule: "hl7v2/PID-7" },
    { path: "PID-11", category: "address", rule: "hl7v2/PID-11" },
    { path: "PID-13", category: "phone", rule: "hl7v2/PID-13" },
    { path: "PID-19", category: "id", rule: "hl7v2/PID-19" },
    {
      pattern: /^OBX-5/,
      category: "free-text",
      rule: "hl7v2/OBX-5",
      strategy: "flag-only",
    },
  ],
};

const FHIR_JSON_MIN_RULES: RulePack = {
  format: "fhir-json",
  rules: [
    {
      path: "Patient.identifier[0].value",
      category: "id",
      rule: "fhir/identifier",
    },
    { path: "Patient.name[0].family", category: "name", rule: "fhir/family" },
    {
      pattern: /^Patient\.name\[\d+\]\.given\[\d+\]$/,
      category: "name",
      rule: "fhir/given",
    },
    {
      pattern: /^Patient\.telecom\[\d+\]\.value$/,
      category: "phone",
      rule: "fhir/telecom",
    },
    { path: "Patient.birthDate", category: "date", rule: "fhir/birthDate" },
  ],
};

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const HL7V2_INPUT =
  "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5\r" +
  "PID|1||MRN12345^^^HOSP^MR||DOE^JOHN^Q||19850315|M|||100 MAIN ST^^ORLANDO^FL^32801||(407)555-1234|||||ACCT-9876|123-45-6789\r" +
  "OBX|1|TX|Note^Note^L||SSN on file is 123-45-6789|||||F";

const PATIENT_JSON = JSON.stringify({
  resourceType: "Patient",
  id: "example",
  identifier: [{ system: "urn:oid:1.2.3", value: "MRN12345" }],
  name: [{ family: "Doe", given: ["John"] }],
  telecom: [{ system: "phone", value: "555-555-1234" }],
  birthDate: "1985-03-15",
});

// -----------------------------------------------------------------------------
// End-to-end
// -----------------------------------------------------------------------------

describe("engine — HL7 v2 end-to-end", () => {
  it("redacts a full PID into themed fakes", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const result = await engine.redact(HL7V2_INPUT);
    expect(result.format).toBe("hl7v2");
    expect(result.detectionConfidence).toBeGreaterThanOrEqual(0.9);

    const pidLine = result.redacted
      .split("\r")
      .find((l) => l.startsWith("PID"))!;
    expect(pidLine).not.toContain("DOE^JOHN");
    expect(pidLine).not.toContain("100 MAIN ST");
    expect(pidLine).not.toContain("19850315");
    expect(pidLine).not.toContain("123-45-6789");
    expect(pidLine).toMatch(/THUNDERER\^THOR/);
    expect(pidLine).toMatch(/MRN-FAKE-/);
    expect(pidLine).toMatch(/000-00-0001/);
  });

  it("free-text OBX-5 keeps narrative but flags embedded SSN", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const result = await engine.redact(HL7V2_INPUT);
    const obxLine = result.redacted
      .split("\r")
      .find((l) => l.startsWith("OBX"))!;
    expect(obxLine).toContain("SSN on file is 123-45-6789");
    expect(
      result.findings.some(
        (f) => f.rule === "hl7v2/OBX-5" && f.confidence < 1,
      ),
    ).toBe(true);
  });

  it("returns serialized text + tokenized tree + findings + parseErrors", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const result = await engine.redact(HL7V2_INPUT);
    expect(typeof result.redacted).toBe("string");
    expect(result.tree.format).toBe("hl7v2");
    expect(result.tree.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(Array.isArray(result.parseErrors)).toBe(true);
  });

  it("cross-message consistency: same input -> same fake", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const a = await engine.redact(HL7V2_INPUT);
    const b = await engine.redact(HL7V2_INPUT);
    expect(b.redacted).toBe(a.redacted);
  });

  it("reset() clears bindings — same input gets same fakes from a clean state", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const before = await engine.redact(HL7V2_INPUT);
    engine.reset();
    const after = await engine.redact(HL7V2_INPUT);
    expect(after.redacted).toBe(before.redacted);
  });
});

describe("engine — FHIR JSON end-to-end", () => {
  it("redacts FHIR Patient and re-parses to valid JSON", async () => {
    const engine = createEngine({
      rulePacks: { "fhir-json": FHIR_JSON_MIN_RULES },
    });
    const result = await engine.redact(PATIENT_JSON);
    expect(result.format).toBe("fhir-json");
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.resourceType).toBe("Patient");
    expect(reparsed.name[0].family).toMatch(/^[A-Z_0-9]+$/);
    expect(reparsed.name[0].family).not.toBe("Doe");
    expect(reparsed.identifier[0].value).toMatch(/^MRN-FAKE-/);
    expect(reparsed.birthDate).toBe("1950-01-01");
  });
});

describe("engine — format detection", () => {
  it("auto-detects format when not provided", async () => {
    const engine = createEngine({ rulePacks: { hl7v2: HL7V2_MIN_RULES } });
    const result = await engine.redact(HL7V2_INPUT);
    expect(result.format).toBe("hl7v2");
  });

  it("uses explicit format override", async () => {
    const engine = createEngine();
    const result = await engine.redact("PID|1||MRN", { format: "hl7v2" });
    expect(result.format).toBe("hl7v2");
    expect(result.detectionConfidence).toBe(1);
  });

  it("throws when confidence is too low and no override given", async () => {
    const engine = createEngine();
    await expect(engine.redact("hello world")).rejects.toThrow(/format/i);
  });

  it("detectFormat() exposes detection without redaction", async () => {
    const engine = createEngine();
    const detection = await engine.detectFormat(HL7V2_INPUT);
    expect(detection.format).toBe("hl7v2");
    expect(detection.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe("engine — empty rule packs override", () => {
  it("explicit empty pack disables redaction for that format", async () => {
    const engine = createEngine({
      rulePacks: { hl7v2: { format: "hl7v2", rules: [] } },
    });
    const result = await engine.redact(HL7V2_INPUT);
    expect(result.findings).toHaveLength(0);
    expect(result.redacted).toBe(HL7V2_INPUT);
  });
});

describe("engine — bundled DEFAULT_RULE_PACKS", () => {
  it("createEngine() with no config redacts using bundled HL7 v2 pack", async () => {
    const engine = createEngine();
    const result = await engine.redact(HL7V2_INPUT);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.redacted).not.toBe(HL7V2_INPUT);
  });

  it("createEngine() with no config redacts FHIR JSON via bundled pack", async () => {
    const engine = createEngine();
    const result = await engine.redact(PATIENT_JSON);
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.name[0].family).not.toBe("Doe");
    expect(reparsed.identifier[0].value).not.toBe("MRN12345");
  });
});
