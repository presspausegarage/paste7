import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine.js";
import {
  HL7V2_RULES,
  FHIR_JSON_RULES,
  FHIR_XML_RULES,
  CDA_RULES,
  HL7V3_RULES,
  DEFAULT_RULE_PACKS,
} from "../src/rules/index.js";

// -----------------------------------------------------------------------------
// Rule pack invariants
// -----------------------------------------------------------------------------

describe("rule pack invariants", () => {
  const packs = [
    HL7V2_RULES,
    FHIR_JSON_RULES,
    FHIR_XML_RULES,
    CDA_RULES,
    HL7V3_RULES,
  ];

  it("every rule has either path or pattern (mutually exclusive)", () => {
    for (const pack of packs) {
      for (const rule of pack.rules) {
        const hasPath = rule.path !== undefined;
        const hasPattern = rule.pattern !== undefined;
        expect(hasPath || hasPattern).toBe(true);
        expect(hasPath && hasPattern).toBe(false);
      }
    }
  });

  it("every rule has a unique rule id within its pack", () => {
    for (const pack of packs) {
      const seen = new Map<string, number>();
      for (const rule of pack.rules) {
        seen.set(rule.rule, (seen.get(rule.rule) ?? 0) + 1);
      }
      for (const [id, count] of seen) {
        expect(count, `${pack.format}: rule id ${id} duplicated`).toBe(1);
      }
    }
  });

  it("DEFAULT_RULE_PACKS covers all five formats", () => {
    expect(Object.keys(DEFAULT_RULE_PACKS).sort()).toEqual([
      "cda",
      "fhir-json",
      "fhir-xml",
      "hl7v2",
      "hl7v3",
    ]);
    for (const [format, pack] of Object.entries(DEFAULT_RULE_PACKS)) {
      expect(pack.format).toBe(format);
      expect(pack.rules.length).toBeGreaterThan(0);
    }
  });
});

// -----------------------------------------------------------------------------
// HL7 v2 — multi-segment coverage
// -----------------------------------------------------------------------------

describe("HL7 v2 rule pack — multi-segment coverage", () => {
  // IN1-16 (Insured's Name) sits 12 fields after IN1-4 (Aetna), so the IN1
  // line below has exactly 12 separators between Aetna and DOE^JOHN.
  const IN1_LINE =
    "IN1|1|PLAN-A|INS-CO-1|Aetna" + "|".repeat(12) + "DOE^JOHN|SELF|19850315|100 MAIN ST^^ORLANDO^FL^32801";

  const HL7V2_RICH =
    "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5\r" +
    "PID|1||MRN12345^^^HOSP^MR||DOE^JOHN||19850315|M|||100 MAIN ST^^ORLANDO^FL^32801||(407)555-1234|||||ACCT-9876|123-45-6789\r" +
    "NK1|1|SMITH^MARY|MTH|99 RIVER RD^^TAMPA^FL^33602|(813)555-7777\r" +
    "GT1|1|GUAR-001|JONES^ROBERT||1 OAK LN^^MIAMI^FL^33101|(305)555-2222||19601112\r" +
    IN1_LINE + "\r" +
    "OBX|1|TX|Note^Note^L||Patient SSN is 123-45-6789|||||F\r" +
    "NTE|1||Note text with phone 407-555-9999";

  it("redacts patient name across PID, NK1, GT1, IN1", async () => {
    const engine = createEngine();
    const result = await engine.redact(HL7V2_RICH);
    expect(result.redacted).not.toContain("DOE^JOHN");
    expect(result.redacted).not.toContain("SMITH^MARY");
    expect(result.redacted).not.toContain("JONES^ROBERT");
  });

  it("redacts identifiers across multiple segments", async () => {
    const engine = createEngine();
    const result = await engine.redact(HL7V2_RICH);
    expect(result.redacted).not.toContain("MRN12345");
    expect(result.redacted).not.toContain("GUAR-001");
    expect(result.redacted).not.toContain("ACCT-9876");
  });

  it("flags free-text in OBX-5 and NTE-3 without rewriting", async () => {
    const engine = createEngine();
    const result = await engine.redact(HL7V2_RICH);
    const obxLine = result.redacted.split("\r").find((l) => l.startsWith("OBX"))!;
    const nteLine = result.redacted.split("\r").find((l) => l.startsWith("NTE"))!;
    expect(obxLine).toContain("123-45-6789");
    expect(nteLine).toContain("407-555-9999");
    const obxFinding = result.findings.find(
      (f) => f.rule === "hl7v2/OBX-5" && f.confidence < 1,
    );
    const nteFinding = result.findings.find(
      (f) => f.rule === "hl7v2/NTE-3" && f.confidence < 1,
    );
    expect(obxFinding).toBeDefined();
    expect(nteFinding).toBeDefined();
  });

  it("preserves non-PHI MSH routing fields", async () => {
    const engine = createEngine();
    const result = await engine.redact(HL7V2_RICH);
    expect(result.redacted).toContain("MSH|");
    expect(result.redacted).toContain("EPIC");
    expect(result.redacted).toContain("RIH");
    expect(result.redacted).toContain("ADT^A01");
  });
});

// -----------------------------------------------------------------------------
// FHIR JSON — Bundle traversal and resource breadth
// -----------------------------------------------------------------------------

describe("FHIR JSON rule pack — Bundle and multi-resource", () => {
  const BUNDLE = JSON.stringify({
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "p-1",
          identifier: [{ system: "urn:oid:1.2.3", value: "MRN12345" }],
          name: [{ family: "Doe", given: ["John"] }],
          telecom: [{ system: "phone", value: "555-555-1234" }],
          birthDate: "1985-03-15",
          address: [
            {
              line: ["100 Main St"],
              city: "Orlando",
              postalCode: "32801",
            },
          ],
        },
      },
      {
        resource: {
          resourceType: "Practitioner",
          id: "pr-1",
          identifier: [{ value: "NPI-1234567890" }],
          name: [{ family: "Smith", given: ["Alice"] }],
        },
      },
      {
        resource: {
          resourceType: "RelatedPerson",
          id: "rp-1",
          name: [{ family: "Wilson", given: ["Bob"] }],
          telecom: [{ system: "email", value: "bob.wilson@example.com" }],
        },
      },
    ],
  });

  it("redacts patient PHI inside Bundle.entry[0].resource", async () => {
    const engine = createEngine();
    const result = await engine.redact(BUNDLE);
    const reparsed = JSON.parse(result.redacted);
    const patient = reparsed.entry[0].resource;
    expect(patient.name[0].family).not.toBe("Doe");
    expect(patient.identifier[0].value).not.toBe("MRN12345");
    expect(patient.address[0].line[0]).not.toBe("100 Main St");
    expect(patient.address[0].city).not.toBe("Orlando");
    expect(patient.address[0].postalCode).not.toBe("32801");
    expect(patient.birthDate).toBe("1950-01-01");
  });

  it("redacts Practitioner and RelatedPerson PHI in the same Bundle", async () => {
    const engine = createEngine();
    const result = await engine.redact(BUNDLE);
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.entry[1].resource.name[0].family).not.toBe("Smith");
    expect(reparsed.entry[1].resource.identifier[0].value).not.toBe(
      "NPI-1234567890",
    );
    expect(reparsed.entry[2].resource.name[0].family).not.toBe("Wilson");
    expect(reparsed.entry[2].resource.telecom[0].value).not.toBe(
      "bob.wilson@example.com",
    );
  });

  it("redacts resource-level id only on PHI-bearing resource types", async () => {
    const engine = createEngine();
    const result = await engine.redact(BUNDLE);
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.entry[0].resource.id).not.toBe("p-1");
    expect(reparsed.entry[1].resource.id).not.toBe("pr-1");
    expect(reparsed.entry[2].resource.id).not.toBe("rp-1");
    // Bundle.id (top-level) wasn't set — and even if it were, it's not in the
    // resource-id rule. Just confirm Bundle structure preserved.
    expect(reparsed.resourceType).toBe("Bundle");
    expect(reparsed.type).toBe("collection");
  });
});

// -----------------------------------------------------------------------------
// FHIR XML
// -----------------------------------------------------------------------------

describe("FHIR XML rule pack", () => {
  const FHIR_XML =
    `<?xml version="1.0"?>` +
    `<Patient xmlns="http://hl7.org/fhir">` +
    `<id value="p-1"/>` +
    `<identifier><value value="MRN12345"/></identifier>` +
    `<name>` +
    `<family value="Doe"/>` +
    `<given value="John"/>` +
    `</name>` +
    `<telecom><system value="phone"/><value value="555-555-1234"/></telecom>` +
    `<birthDate value="1985-03-15"/>` +
    `<address>` +
    `<line value="100 Main St"/>` +
    `<city value="Orlando"/>` +
    `<postalCode value="32801"/>` +
    `</address>` +
    `</Patient>`;

  it("redacts attribute-valued leaves at default", async () => {
    const engine = createEngine();
    const result = await engine.redact(FHIR_XML);
    expect(result.redacted).not.toContain('value="Doe"');
    expect(result.redacted).not.toContain('value="John"');
    expect(result.redacted).not.toContain('value="MRN12345"');
    expect(result.redacted).not.toContain('value="100 Main St"');
    expect(result.redacted).not.toContain('value="Orlando"');
    expect(result.redacted).not.toContain('value="32801"');
  });

  it("preserves non-PHI namespace and structure", async () => {
    const engine = createEngine();
    const result = await engine.redact(FHIR_XML);
    expect(result.redacted).toContain('xmlns="http://hl7.org/fhir"');
    expect(result.redacted).toContain("Patient");
    expect(result.redacted).toContain('value="phone"');
  });
});

// -----------------------------------------------------------------------------
// CDA + HL7 v3 (shared RIM rules)
// -----------------------------------------------------------------------------

describe("CDA rule pack", () => {
  const CDA =
    `<?xml version="1.0"?>` +
    `<ClinicalDocument xmlns="urn:hl7-org:v3">` +
    `<id root="2.16.840.1.113883.19.5" extension="DOC-001"/>` +
    `<recordTarget>` +
    `<patientRole>` +
    `<id root="2.16.840.1.113883.19.5" extension="MRN12345"/>` +
    `<addr>` +
    `<streetAddressLine>100 Main St</streetAddressLine>` +
    `<city>Orlando</city>` +
    `<postalCode>32801</postalCode>` +
    `</addr>` +
    `<telecom value="tel:+14075551234"/>` +
    `<patient>` +
    `<name><given>John</given><family>Doe</family></name>` +
    `<birthTime value="19850315"/>` +
    `</patient>` +
    `</patientRole>` +
    `</recordTarget>` +
    `<author>` +
    `<assignedAuthor>` +
    `<id root="2.16.840.1.113883.4.6" extension="NPI-9999"/>` +
    `<assignedPerson><name><given>Alice</given><family>Smith</family></name></assignedPerson>` +
    `</assignedAuthor>` +
    `</author>` +
    `</ClinicalDocument>`;

  it("redacts patient PHI under recordTarget", async () => {
    const engine = createEngine();
    const result = await engine.redact(CDA);
    expect(result.redacted).not.toContain("MRN12345");
    expect(result.redacted).not.toContain(">John<");
    expect(result.redacted).not.toContain(">Doe<");
    expect(result.redacted).not.toContain("19850315");
    expect(result.redacted).not.toContain(">100 Main St<");
    expect(result.redacted).not.toContain(">Orlando<");
    expect(result.redacted).not.toContain(">32801<");
  });

  it("redacts author/assignedAuthor PHI", async () => {
    const engine = createEngine();
    const result = await engine.redact(CDA);
    expect(result.redacted).not.toContain("NPI-9999");
    expect(result.redacted).not.toContain(">Alice<");
    expect(result.redacted).not.toContain(">Smith<");
  });

  it("preserves the document's structural id (not patient-bound)", async () => {
    const engine = createEngine();
    const result = await engine.redact(CDA);
    // /ClinicalDocument/id is the document instance id, not patient PHI.
    // It's not under recordTarget so the shared rule shouldn't fire on it.
    expect(result.redacted).toContain("DOC-001");
  });
});

describe("HL7 v3 rule pack", () => {
  const V3_MSG =
    `<?xml version="1.0"?>` +
    `<MCCI_IN000002UV01 xmlns="urn:hl7-org:v3">` +
    `<id extension="MSG-001"/>` +
    `<controlActProcess>` +
    `<subject>` +
    `<patient>` +
    `<id root="2.16.840.1.113883.19.5" extension="MRN12345"/>` +
    `<name><given>John</given><family>Doe</family></name>` +
    `<birthTime value="19850315"/>` +
    `</patient>` +
    `</subject>` +
    `</controlActProcess>` +
    `</MCCI_IN000002UV01>`;

  it("redacts patient under subject/patient (v3-style wrapper)", async () => {
    const engine = createEngine();
    const result = await engine.redact(V3_MSG);
    expect(result.redacted).not.toContain("MRN12345");
    expect(result.redacted).not.toContain(">John<");
    expect(result.redacted).not.toContain(">Doe<");
    expect(result.redacted).not.toContain("19850315");
  });

  it("preserves the message control id (not patient-bound)", async () => {
    const engine = createEngine();
    const result = await engine.redact(V3_MSG);
    expect(result.redacted).toContain("MSG-001");
  });

  // Standard PRPA messaging uses the RIM Role/Entity split — patient.id is
  // on the Role, but name/birthTime/addr/telecom live under patientPerson.
  // Regression guard for the patternPerson nesting that the original v3 rules
  // did not match (caught 2026-05-01 during runtime smoke testing).
  const PRPA_MSG =
    `<?xml version="1.0"?>` +
    `<PRPA_IN201304UV02 xmlns="urn:hl7-org:v3">` +
    `<id extension="MSG-PRPA-001"/>` +
    `<controlActProcess>` +
    `<subject>` +
    `<registrationEvent>` +
    `<subject1>` +
    `<patient>` +
    `<id root="2.16.840.1.113883.19.5" extension="MRN-PRPA-77777"/>` +
    `<patientPerson>` +
    `<name><given>Jane</given><family>Doe</family></name>` +
    `<telecom value="tel:+14075550123"/>` +
    `<birthTime value="19850412"/>` +
    `<addr><streetAddressLine>123 Fake Street</streetAddressLine>` +
    `<city>Orlando</city><state>FL</state><postalCode>32801</postalCode></addr>` +
    `</patientPerson>` +
    `</patient>` +
    `</subject1>` +
    `</registrationEvent>` +
    `</subject>` +
    `</controlActProcess>` +
    `</PRPA_IN201304UV02>`;

  it("redacts patientPerson-nested fields (RIM Role/Entity split)", async () => {
    const engine = createEngine();
    const result = await engine.redact(PRPA_MSG);
    expect(result.redacted).not.toContain("MRN-PRPA-77777");
    expect(result.redacted).not.toContain(">Jane<");
    expect(result.redacted).not.toContain(">Doe<");
    expect(result.redacted).not.toContain("tel:+14075550123");
    expect(result.redacted).not.toContain("19850412");
    expect(result.redacted).not.toContain("123 Fake Street");
    expect(result.redacted).not.toContain(">Orlando<");
    expect(result.redacted).not.toContain(">32801<");
  });

  it("emits findings for every PRPA patientPerson field", async () => {
    const engine = createEngine();
    const result = await engine.redact(PRPA_MSG);
    const ruleIds = new Set(result.findings.map((f) => f.rule));
    expect(ruleIds.has("v3/subject.patient.id")).toBe(true);
    expect(ruleIds.has("v3/subject.patient.name")).toBe(true);
    expect(ruleIds.has("v3/subject.patient.birthTime")).toBe(true);
    expect(ruleIds.has("v3/subject.patient.telecom")).toBe(true);
    expect(ruleIds.has("v3/subject.patient.addr")).toBe(true);
  });
});
