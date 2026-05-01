import { describe, expect, it } from "vitest";
import { xmlWalker } from "../../src/walkers/xml.js";
import type {
  Finding,
  FreeTextScanRequest,
  RedactRequest,
  RedactResponse,
  Redactor,
  RulePack,
} from "../../src/index.js";

// -----------------------------------------------------------------------------
// Stub redactor
// -----------------------------------------------------------------------------

function createStubRedactor(): Redactor {
  const counters = new Map<string, number>();
  return {
    apply(req: RedactRequest): RedactResponse {
      let value: string | null;
      switch (req.strategy) {
        case "substitute": {
          const n = (counters.get(req.category) ?? 0) + 1;
          counters.set(req.category, n);
          value = `[FAKE:${req.category}:${n}]`;
          break;
        }
        case "scrub":
          value = "[REDACTED]";
          break;
        case "flag-only":
          value = req.value;
          break;
        case "remove":
          value = null;
          break;
      }
      return {
        value,
        finding: {
          path: req.path,
          category: req.category,
          strategy: req.strategy,
          rule: req.rule,
          originalLength: req.value.length,
          confidence: 1,
          redactedValue: value,
        },
      };
    },
    scanFreeText(req: FreeTextScanRequest): ReadonlyArray<Finding> {
      const out: Finding[] = [];
      const ssnRe = /\b\d{3}-\d{2}-\d{4}\b/g;
      let m: RegExpExecArray | null;
      while ((m = ssnRe.exec(req.value)) !== null) {
        out.push({
          path: req.path,
          category: "id",
          strategy: "flag-only",
          redactedValue: m[0],
          originalLength: m[0].length,
          rule: req.rule,
          confidence: 0.9,
        });
      }
      return out;
    },
  };
}

// -----------------------------------------------------------------------------
// CDA fixture
// -----------------------------------------------------------------------------

const CDA_DOC =
  `<?xml version="1.0"?>` +
  `<ClinicalDocument xmlns="urn:hl7-org:v3">` +
  `<id root="2.16.840.1.113883.19.5" extension="999021"/>` +
  `<recordTarget>` +
  `<patientRole>` +
  `<id root="2.16.840.1.113883.19.5" extension="MRN12345"/>` +
  `<patient>` +
  `<name>` +
  `<given>John</given>` +
  `<family>Doe</family>` +
  `</name>` +
  `<administrativeGenderCode code="M"/>` +
  `<birthTime value="19850315"/>` +
  `</patient>` +
  `</patientRole>` +
  `</recordTarget>` +
  `<text>SSN on file is 123-45-6789</text>` +
  `</ClinicalDocument>`;

const CDA_RULES: RulePack = {
  format: "cda",
  rules: [
    {
      path: "/ClinicalDocument/recordTarget/patientRole/id/@extension",
      category: "id",
      rule: "cda/patientRole.id",
    },
    {
      path: "/ClinicalDocument/recordTarget/patientRole/patient/name/given",
      category: "name",
      rule: "cda/name.given",
    },
    {
      path: "/ClinicalDocument/recordTarget/patientRole/patient/name/family",
      category: "name",
      rule: "cda/name.family",
    },
    {
      path: "/ClinicalDocument/recordTarget/patientRole/patient/birthTime/@value",
      category: "date",
      rule: "cda/birthTime",
    },
    {
      path: "/ClinicalDocument/text",
      category: "free-text",
      rule: "cda/text",
      strategy: "flag-only",
    },
  ],
};

// -----------------------------------------------------------------------------
// FHIR XML fixture (attribute-valued leaves)
// -----------------------------------------------------------------------------

const FHIR_PATIENT =
  `<?xml version="1.0"?>` +
  `<Patient xmlns="http://hl7.org/fhir">` +
  `<id value="example"/>` +
  `<identifier>` +
  `<system value="urn:oid:1.2.3"/>` +
  `<value value="MRN12345"/>` +
  `</identifier>` +
  `<name>` +
  `<family value="Doe"/>` +
  `<given value="John"/>` +
  `<given value="Q"/>` +
  `</name>` +
  `<gender value="male"/>` +
  `<birthDate value="1985-03-15"/>` +
  `<address>` +
  `<line value="100 Main St"/>` +
  `<city value="Orlando"/>` +
  `<state value="FL"/>` +
  `<postalCode value="32801"/>` +
  `</address>` +
  `</Patient>`;

const FHIR_XML_RULES: RulePack = {
  format: "fhir-xml",
  rules: [
    { path: "/Patient/identifier/value/@value", category: "id", rule: "fhir/identifier.value" },
    { path: "/Patient/name/family/@value", category: "name", rule: "fhir/name.family" },
    { path: "/Patient/name/given/@value", category: "name", rule: "fhir/name.given" },
    { path: "/Patient/birthDate/@value", category: "date", rule: "fhir/birthDate" },
    { path: "/Patient/address/line/@value", category: "address", rule: "fhir/address.line" },
    { path: "/Patient/address/city/@value", category: "address", rule: "fhir/address.city" },
    { path: "/Patient/address/postalCode/@value", category: "address", rule: "fhir/address.postalCode" },
  ],
};

// -----------------------------------------------------------------------------
// Parse + format detection
// -----------------------------------------------------------------------------

describe("xml walker — parse + format detection", () => {
  it("detects CDA from ClinicalDocument root", () => {
    const { parsed, parseErrors } = xmlWalker.parse(CDA_DOC);
    expect(parseErrors).toHaveLength(0);
    expect(parsed.format).toBe("cda");
  });

  it("detects FHIR XML from FHIR namespace", () => {
    const { parsed, parseErrors } = xmlWalker.parse(FHIR_PATIENT);
    expect(parseErrors).toHaveLength(0);
    expect(parsed.format).toBe("fhir-xml");
  });

  it("detects HL7 v3 messaging from urn:hl7-org:v3 with non-CDA root", () => {
    const v3 =
      `<?xml version="1.0"?>` +
      `<MCCI_IN000002UV01 xmlns="urn:hl7-org:v3"><id/></MCCI_IN000002UV01>`;
    const { parsed } = xmlWalker.parse(v3);
    expect(parsed.format).toBe("hl7v3");
  });

  it("returns parse error on malformed XML", () => {
    const { parseErrors } = xmlWalker.parse(`<unclosed`);
    expect(parseErrors[0]?.severity).toBe("error");
  });
});

// -----------------------------------------------------------------------------
// CDA redaction
// -----------------------------------------------------------------------------

describe("xml walker — CDA", () => {
  it("redacts element-text leaves and attribute values", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);

    expect(result.redacted).not.toContain(">John<");
    expect(result.redacted).not.toContain(">Doe<");
    expect(result.redacted).toContain("[FAKE:name:");
    // patientRole id @extension was MRN12345 — substituted
    expect(result.redacted).not.toContain('extension="MRN12345"');
    expect(result.redacted).toContain('extension="[FAKE:id:1]"');
    // birthTime @value was 19850315 — substituted
    expect(result.redacted).not.toContain('value="19850315"');
  });

  it("preserves the document namespace and root element", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);
    expect(result.redacted).toContain("ClinicalDocument");
    expect(result.redacted).toContain('xmlns="urn:hl7-org:v3"');
  });

  it("free-text rule on /ClinicalDocument/text preserves text but flags embedded SSN", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);
    expect(result.redacted).toContain("SSN on file is 123-45-6789");
    const scan = result.findings.filter(
      (f) => f.rule === "cda/text" && f.confidence < 1,
    );
    expect(scan).toHaveLength(1);
  });

  it("emits a TokenTree with element + attribute kinds", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);
    expect(result.tree.format).toBe("cda");
    expect(result.tree.nodes).toHaveLength(1);
    expect(result.tree.nodes[0]!.path).toBe("/ClinicalDocument");
    expect(result.tree.nodes[0]!.kind).toBe("element");
  });

  it("marks redacted leaf elements with redaction metadata", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);
    const family = findByPath(
      result.tree.nodes,
      "/ClinicalDocument/recordTarget/patientRole/patient/name/family",
    );
    expect(family).toBeDefined();
    expect(family!.redaction).toBeDefined();
    expect(family!.redaction!.category).toBe("name");
    expect(family!.redaction!.originalLength).toBe("Doe".length);
  });

  it("marks redacted attributes with redaction metadata", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, CDA_RULES, stub);
    const ext = findByPath(
      result.tree.nodes,
      "/ClinicalDocument/recordTarget/patientRole/id/@extension",
    );
    expect(ext).toBeDefined();
    expect(ext!.kind).toBe("attribute");
    expect(ext!.redaction).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// FHIR XML redaction
// -----------------------------------------------------------------------------

describe("xml walker — FHIR XML", () => {
  it("redacts attribute-valued leaves (the FHIR XML idiom)", () => {
    const { parsed } = xmlWalker.parse(FHIR_PATIENT);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, FHIR_XML_RULES, stub);

    expect(result.redacted).not.toContain('value="Doe"');
    expect(result.redacted).not.toContain('value="John"');
    expect(result.redacted).not.toContain('value="MRN12345"');
    expect(result.redacted).not.toContain('value="100 Main St"');
    expect(result.redacted).toContain("[FAKE:name:");
    expect(result.redacted).toContain("[FAKE:id:");
  });

  it("preserves non-PHI attributes (gender, document namespace)", () => {
    const { parsed } = xmlWalker.parse(FHIR_PATIENT);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, FHIR_XML_RULES, stub);
    expect(result.redacted).toContain('value="male"');
    expect(result.redacted).toContain('xmlns="http://hl7.org/fhir"');
    expect(result.redacted).toContain('value="example"'); // Patient.id
  });

  it("fires the rule for every repeated element (two given names)", () => {
    const { parsed } = xmlWalker.parse(FHIR_PATIENT);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(parsed, FHIR_XML_RULES, stub);
    const givenFindings = result.findings.filter(
      (f) => f.rule === "fhir/name.given",
    );
    expect(givenFindings).toHaveLength(2);
  });
});

describe("xml walker — round-trip", () => {
  it("CDA: serialized output re-parses without errors", () => {
    const { parsed } = xmlWalker.parse(CDA_DOC);
    const stub = createStubRedactor();
    const once = xmlWalker.redact(parsed, CDA_RULES, stub);
    const reparse = xmlWalker.parse(once.redacted);
    expect(reparse.parseErrors).toHaveLength(0);
  });

  it("FHIR XML: serialized output re-parses without errors", () => {
    const { parsed } = xmlWalker.parse(FHIR_PATIENT);
    const stub = createStubRedactor();
    const once = xmlWalker.redact(parsed, FHIR_XML_RULES, stub);
    const reparse = xmlWalker.parse(once.redacted);
    expect(reparse.parseErrors).toHaveLength(0);
  });

  it("FHIR XML: zero-rule pack preserves the input shape on round-trip", () => {
    const { parsed } = xmlWalker.parse(FHIR_PATIENT);
    const stub = createStubRedactor();
    const result = xmlWalker.redact(
      parsed,
      { format: "fhir-xml", rules: [] },
      stub,
    );
    expect(result.findings).toHaveLength(0);
    const reparse = xmlWalker.parse(result.redacted);
    expect(reparse.parseErrors).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface AnyNode {
  path: string;
  kind: string;
  value?: string | null;
  redaction?: { category: string; originalLength: number; rule: string };
  children?: ReadonlyArray<AnyNode>;
}

function findByPath(
  nodes: ReadonlyArray<unknown>,
  target: string,
): AnyNode | undefined {
  for (const n of nodes) {
    const node = n as AnyNode;
    if (node.path === target) return node;
    if (node.children) {
      const hit = findByPath(node.children, target);
      if (hit) return hit;
    }
  }
  return undefined;
}
