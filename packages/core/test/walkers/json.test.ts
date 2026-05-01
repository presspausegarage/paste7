import { describe, expect, it } from "vitest";
import { fhirJsonWalker } from "../../src/walkers/json.js";
import type {
  Finding,
  FreeTextScanRequest,
  RedactRequest,
  RedactResponse,
  Redactor,
  RulePack,
} from "../../src/index.js";

// -----------------------------------------------------------------------------
// Stub redactor (same shape as the hl7v2 walker test stub)
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
// Fixtures
// -----------------------------------------------------------------------------

const PATIENT = {
  resourceType: "Patient",
  id: "example",
  identifier: [
    {
      system: "urn:oid:1.2.3",
      value: "MRN12345",
    },
  ],
  name: [
    {
      use: "official",
      family: "Doe",
      given: ["John", "Q"],
    },
  ],
  telecom: [
    { system: "phone", value: "555-555-1234", use: "home" },
    { system: "email", value: "john.doe@example.com" },
  ],
  gender: "male",
  birthDate: "1985-03-15",
  address: [
    {
      use: "home",
      line: ["100 Main St"],
      city: "Orlando",
      state: "FL",
      postalCode: "32801",
    },
  ],
  text: {
    status: "generated",
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Patient SSN is 123-45-6789</div>',
  },
};

const RULES: RulePack = {
  format: "fhir-json",
  rules: [
    { path: "Patient.identifier[0].value", category: "id", rule: "fhir/Patient.identifier.value" },
    { path: "Patient.name[0].family", category: "name", rule: "fhir/Patient.name.family" },
    { pattern: /^Patient\.name\[\d+\]\.given\[\d+\]$/, category: "name", rule: "fhir/Patient.name.given" },
    { pattern: /^Patient\.telecom\[\d+\]\.value$/, category: "phone", rule: "fhir/Patient.telecom.value" },
    { path: "Patient.birthDate", category: "date", rule: "fhir/Patient.birthDate" },
    { pattern: /^Patient\.address\[\d+\]\.line\[\d+\]$/, category: "address", rule: "fhir/Patient.address.line" },
    { path: "Patient.address[0].city", category: "address", rule: "fhir/Patient.address.city" },
    { path: "Patient.address[0].postalCode", category: "address", rule: "fhir/Patient.address.postalCode" },
    { path: "Patient.text.div", category: "free-text", rule: "fhir/Patient.text.div", strategy: "flag-only" },
  ],
};

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

describe("fhir-json walker — parse", () => {
  it("uses resourceType as the root path label", () => {
    const { parsed, parseErrors } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    expect(parseErrors).toHaveLength(0);
    expect(parsed.rootLabel).toBe("Patient");
  });

  it("warns when no resourceType is present", () => {
    const { parsed, parseErrors } = fhirJsonWalker.parse(JSON.stringify({ name: "x" }));
    expect(parsed.rootLabel).toBe("Resource");
    expect(parseErrors[0]?.message).toMatch(/resourceType/);
  });

  it("returns a parse error on invalid JSON", () => {
    const { parseErrors } = fhirJsonWalker.parse("{ not valid");
    expect(parseErrors[0]?.severity).toBe("error");
  });

  it("warns and uses 'Array' as root for top-level arrays", () => {
    const { parsed, parseErrors } = fhirJsonWalker.parse(
      JSON.stringify([{ resourceType: "Patient" }]),
    );
    expect(parsed.rootLabel).toBe("Array");
    expect(parseErrors[0]?.severity).toBe("warning");
  });
});

// -----------------------------------------------------------------------------
// Redact
// -----------------------------------------------------------------------------

describe("fhir-json walker — redact", () => {
  it("redacts every leaf path the rule pack matches", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);

    const ruleHits = new Map<string, number>();
    for (const f of result.findings) {
      ruleHits.set(f.rule, (ruleHits.get(f.rule) ?? 0) + 1);
    }
    expect(ruleHits.get("fhir/Patient.identifier.value")).toBe(1);
    expect(ruleHits.get("fhir/Patient.name.family")).toBe(1);
    expect(ruleHits.get("fhir/Patient.name.given")).toBe(2); // John + Q
    expect(ruleHits.get("fhir/Patient.telecom.value")).toBe(2); // phone + email
    expect(ruleHits.get("fhir/Patient.birthDate")).toBe(1);
    expect(ruleHits.get("fhir/Patient.address.line")).toBe(1);
    expect(ruleHits.get("fhir/Patient.address.city")).toBe(1);
    expect(ruleHits.get("fhir/Patient.address.postalCode")).toBe(1);
  });

  it("substitutes leaf values in the serialized output", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);

    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.name[0].family).toBe("[FAKE:name:1]");
    expect(reparsed.identifier[0].value).toBe("[FAKE:id:1]");
    // Counter ordering depends on object-key walk order; assert the shape, not index.
    expect(reparsed.address[0].city).toMatch(/^\[FAKE:address:\d+\]$/);
    expect(reparsed.address[0].line[0]).toMatch(/^\[FAKE:address:\d+\]$/);
  });

  it("preserves non-PHI structure exactly (resourceType, id, gender unchanged)", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.resourceType).toBe("Patient");
    expect(reparsed.id).toBe("example");
    expect(reparsed.gender).toBe("male");
    expect(reparsed.name[0].use).toBe("official");
  });

  it("flag-only on text.div preserves the narrative and runs the free-text scanner", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);
    const reparsed = JSON.parse(result.redacted);
    expect(reparsed.text.div).toContain("123-45-6789");
    const scanFindings = result.findings.filter(
      (f) => f.rule === "fhir/Patient.text.div" && f.confidence < 1,
    );
    expect(scanFindings.length).toBe(1);
    expect(scanFindings[0]!.category).toBe("id");
  });

  it("emits a TokenTree rooted at the resourceType", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);
    expect(result.tree.format).toBe("fhir-json");
    expect(result.tree.nodes).toHaveLength(1);
    const root = result.tree.nodes[0]!;
    expect(root.path).toBe("Patient");
    expect(root.children).toBeDefined();
    expect(root.children!.length).toBeGreaterThan(0);
  });

  it("marks redacted property nodes with redaction metadata", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);

    const root = result.tree.nodes[0]!;
    const family = findNodeByPath(root, "Patient.name[0].family");
    expect(family).toBeDefined();
    expect(family!.redaction).toBeDefined();
    expect(family!.redaction!.category).toBe("name");
    expect(family!.redaction!.originalLength).toBe("Doe".length);
  });

  it("emits property nodes for non-redacted leaves (gender, id, etc.)", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);

    const root = result.tree.nodes[0]!;
    const gender = findNodeByPath(root, "Patient.gender");
    expect(gender).toBeDefined();
    expect(gender!.value).toBe("male");
    expect(gender!.redaction).toBeUndefined();
  });

  it("never exposes original PHI in finding.redactedValue when substituting", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub = createStubRedactor();
    const result = fhirJsonWalker.redact(parsed, RULES, stub);
    const familyFinding = result.findings.find(
      (f) => f.rule === "fhir/Patient.name.family",
    )!;
    expect(familyFinding.redactedValue).not.toContain("Doe");
  });
});

describe("fhir-json walker — round-trip", () => {
  it("serializes valid JSON that re-parses to the same redacted result", () => {
    const { parsed } = fhirJsonWalker.parse(JSON.stringify(PATIENT));
    const stub1 = createStubRedactor();
    const once = fhirJsonWalker.redact(parsed, RULES, stub1);

    const reparse = fhirJsonWalker.parse(once.redacted);
    expect(reparse.parseErrors).toHaveLength(0);

    const stub2 = createStubRedactor();
    const twice = fhirJsonWalker.redact(reparse.parsed, RULES, stub2);
    expect(twice.redacted).toBe(once.redacted);
  });
});

function findNodeByPath(root: any, target: string): any {
  if (root.path === target) return root;
  if (!root.children) return undefined;
  for (const c of root.children) {
    const hit = findNodeByPath(c, target);
    if (hit) return hit;
  }
  return undefined;
}
