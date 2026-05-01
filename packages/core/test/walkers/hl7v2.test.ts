import { describe, expect, it } from "vitest";
import { hl7v2Walker } from "../../src/walkers/hl7v2.js";
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

/**
 * Test redactor that mimics the Phase 1 step 4 contract without any pool logic:
 *   substitute -> "[FAKE:<category>:<seq>]"
 *   scrub      -> "[REDACTED]"
 *   flag-only  -> echo input
 *   remove     -> null
 * Free-text scanner reports any 9-digit number as id and any @-token as email.
 */
function createStubRedactor(): Redactor {
  const counters = new Map<string, number>();
  return {
    apply(req: RedactRequest): RedactResponse {
      const finding: Finding = {
        path: req.path,
        category: req.category,
        strategy: req.strategy,
        rule: req.rule,
        originalLength: req.value.length,
        confidence: 1,
        redactedValue: null,
      };
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
      finding.redactedValue = value;
      return { value, finding };
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

const SAMPLE_ADT =
  "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5\r" +
  "PID|1||MRN12345^^^HOSP^MR||DOE^JOHN^Q||19850315|M|||100 MAIN ST^^ORLANDO^FL^32801||(407)555-1234~(407)555-9999|||||ACCT-9876|123-45-6789\r" +
  "OBX|1|TX|Note^Note^L||Patient phone is 407-555-0001 and SSN is 123-45-6789|||||F";

const RULES: RulePack = {
  format: "hl7v2",
  rules: [
    { path: "PID-3", category: "id", rule: "hl7v2/PID-3" },
    { path: "PID-5", category: "name", rule: "hl7v2/PID-5" },
    { path: "PID-7", category: "date", rule: "hl7v2/PID-7" },
    { path: "PID-11", category: "address", rule: "hl7v2/PID-11" },
    { path: "PID-13", category: "phone", rule: "hl7v2/PID-13" },
    { path: "PID-18", category: "id", rule: "hl7v2/PID-18" },
    { path: "PID-19", category: "id", rule: "hl7v2/PID-19" },
    { pattern: /^OBX-5/, category: "free-text", rule: "hl7v2/OBX-5", strategy: "flag-only" },
  ],
};

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

describe("hl7v2 walker — parse", () => {
  it("parses a complete ADT message", () => {
    const { parsed, parseErrors } = hl7v2Walker.parse(SAMPLE_ADT);
    expect(parseErrors).toHaveLength(0);
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments[0]!.name).toBe("MSH");
    expect(parsed.segments[1]!.name).toBe("PID");
    expect(parsed.segments[2]!.name).toBe("OBX");
    expect(parsed.separators.field).toBe("|");
    expect(parsed.separators.component).toBe("^");
    expect(parsed.lineEnding).toBe("\r");
  });

  it("preserves component structure under PID-5", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const pid = parsed.segments[1]!;
    const pid5 = pid.fields[5]!;
    expect(pid5.reps).toHaveLength(1);
    expect(pid5.reps[0]!.components).toHaveLength(3);
    expect(pid5.reps[0]!.components[0]!.subcomponents[0]).toBe("DOE");
    expect(pid5.reps[0]!.components[1]!.subcomponents[0]).toBe("JOHN");
    expect(pid5.reps[0]!.components[2]!.subcomponents[0]).toBe("Q");
  });

  it("preserves repetitions in PID-13 phone field", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const pid = parsed.segments[1]!;
    const pid13 = pid.fields[13]!;
    expect(pid13.reps).toHaveLength(2);
  });

  it("parses subcomponents on PID-3 with HOSP^MR identifier system", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const pid = parsed.segments[1]!;
    const pid3 = pid.fields[3]!;
    // MRN12345^^^HOSP^MR — 5 components (ID, empty, empty, assigning authority, type)
    expect(pid3.reps[0]!.components).toHaveLength(5);
    expect(pid3.reps[0]!.components[0]!.subcomponents[0]).toBe("MRN12345");
    expect(pid3.reps[0]!.components[3]!.subcomponents[0]).toBe("HOSP");
    expect(pid3.reps[0]!.components[4]!.subcomponents[0]).toBe("MR");
  });

  it("round-trips the input on parse + serialize with no rules", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, { format: "hl7v2", rules: [] }, stub);
    expect(result.redacted).toBe(SAMPLE_ADT);
    expect(result.findings).toHaveLength(0);
  });

  it("handles non-default separator characters declared in MSH", () => {
    // field=#, component=@, repetition=!, escape=~, subcomponent=/
    const exotic =
      "MSH#@!~/$#EPIC#RIH#REC#RECORG#20240115#~ADT@A01#1#P#2.5\r" +
      "PID#1##MRN!ALT##DOE@JOHN";
    const { parsed, parseErrors } = hl7v2Walker.parse(exotic);
    expect(parseErrors).toHaveLength(0);
    expect(parsed.separators.field).toBe("#");
    expect(parsed.separators.component).toBe("@");
    expect(parsed.separators.repetition).toBe("!");
    expect(parsed.separators.subcomponent).toBe("/");
    const pid = parsed.segments[1]!;
    expect(pid.fields[3]!.reps).toHaveLength(2);
    expect(pid.fields[5]!.reps[0]!.components).toHaveLength(2);
  });

  it("warns on segment without MSH (partial paste)", () => {
    const partial = "PID|1||MRN12345||DOE^JOHN";
    const { parsed, parseErrors } = hl7v2Walker.parse(partial);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors[0]!.severity).toBe("warning");
    expect(parsed.segments).toHaveLength(1);
  });

  it("skips malformed lines that lack a 3-char segment name", () => {
    const bad = "MSH|^~\\&|A|B|C|D|20240115||ADT^A01|1|P|2.5\rXX\rPID|1||MRN";
    const { parsed, parseErrors } = hl7v2Walker.parse(bad);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parsed.segments.map((s) => s.name)).toEqual(["MSH", "PID"]);
  });
});

// -----------------------------------------------------------------------------
// Redact
// -----------------------------------------------------------------------------

describe("hl7v2 walker — redact", () => {
  it("redacts every PID field that matches the rule pack", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);

    const findingsByRule = new Map<string, number>();
    for (const f of result.findings) {
      findingsByRule.set(f.rule, (findingsByRule.get(f.rule) ?? 0) + 1);
    }
    expect(findingsByRule.get("hl7v2/PID-3")).toBe(1);
    expect(findingsByRule.get("hl7v2/PID-5")).toBe(1);
    expect(findingsByRule.get("hl7v2/PID-7")).toBe(1);
    expect(findingsByRule.get("hl7v2/PID-11")).toBe(1);
    // PID-13 has 2 repetitions; one finding per rep
    expect(findingsByRule.get("hl7v2/PID-13")).toBe(2);
    expect(findingsByRule.get("hl7v2/PID-18")).toBe(1);
    expect(findingsByRule.get("hl7v2/PID-19")).toBe(1);
  });

  it("writes substituted values into the serialized output", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    expect(result.redacted).toContain("[FAKE:name:1]");
    expect(result.redacted).toContain("[FAKE:address:1]");
    expect(result.redacted).not.toContain("DOE^JOHN");
    expect(result.redacted).not.toContain("100 MAIN ST");
    // PID-19 SSN substitution: assert against the PID line specifically — OBX-5
    // is flag-only narrative and may legitimately preserve embedded SSN patterns.
    const pidLine = result.redacted.split("\r").find((l) => l.startsWith("PID"))!;
    expect(pidLine).not.toContain("123-45-6789");
  });

  it("preserves segment structure (MSH/PID/OBX still present)", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    const segs = result.redacted.split("\r").map((l) => l.slice(0, 3));
    expect(segs).toEqual(["MSH", "PID", "OBX"]);
  });

  it("preserves field positions when redacting (correct pipe count per segment)", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const original = SAMPLE_ADT.split("\r");
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    const redactedLines = result.redacted.split("\r");
    expect(redactedLines).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(redactedLines[i]!.split("|").length).toBe(
        original[i]!.split("|").length,
      );
    }
  });

  it("flag-only strategy on OBX-5 emits findings without changing field text", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    // OBX-5 narrative is preserved verbatim (flag-only). The substring exists in
    // the redacted output despite containing PHI patterns the scanner flagged.
    expect(result.redacted).toContain("Patient phone is 407-555-0001");
    // Free-text scanner finds the SSN in OBX-5.
    const obxFindings = result.findings.filter((f) =>
      f.rule.startsWith("hl7v2/OBX-5"),
    );
    const hasIdFromScan = obxFindings.some(
      (f) => f.category === "id" && f.confidence < 1,
    );
    expect(hasIdFromScan).toBe(true);
  });

  it("emits a TokenTree with one segment node per parsed segment", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    expect(result.tree.format).toBe("hl7v2");
    expect(result.tree.nodes).toHaveLength(3);
    expect(result.tree.nodes[1]!.path).toBe("PID");
    expect(result.tree.nodes[1]!.kind).toBe("segment");
  });

  it("marks redacted field nodes with redaction metadata", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    const pidNode = result.tree.nodes[1]!;
    const pid5 = pidNode.children!.find((c) => c.path === "PID-5")!;
    expect(pid5.redaction).toBeDefined();
    expect(pid5.redaction!.category).toBe("name");
    expect(pid5.redaction!.rule).toBe("hl7v2/PID-5");
    expect(pid5.redaction!.originalLength).toBe("DOE^JOHN^Q".length);
  });

  it("expands non-redacted single-rep fields into component children", () => {
    // Use a rule pack that only redacts PID-3 so PID-5 stays expandable.
    const limitedRules: RulePack = {
      format: "hl7v2",
      rules: [{ path: "PID-3", category: "id", rule: "hl7v2/PID-3" }],
    };
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, limitedRules, stub);
    const pidNode = result.tree.nodes[1]!;
    const pid5 = pidNode.children!.find((c) => c.path === "PID-5")!;
    expect(pid5.redaction).toBeUndefined();
    expect(pid5.children).toBeDefined();
    expect(pid5.children!.map((c) => c.path)).toEqual([
      "PID-5.1",
      "PID-5.2",
      "PID-5.3",
    ]);
    expect(pid5.children![0]!.value).toBe("DOE");
  });

  it("never exposes original PHI in finding.redactedValue when substituting", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const result = hl7v2Walker.redact(parsed, RULES, stub);
    const pid5Finding = result.findings.find((f) => f.rule === "hl7v2/PID-5")!;
    expect(pid5Finding.redactedValue).not.toContain("DOE");
    expect(pid5Finding.redactedValue).not.toContain("JOHN");
  });
});

describe("hl7v2 walker — serialization round-trip", () => {
  it("produces stable output across two parse/serialize cycles", () => {
    const { parsed } = hl7v2Walker.parse(SAMPLE_ADT);
    const stub = createStubRedactor();
    const once = hl7v2Walker.redact(parsed, RULES, stub);
    const stub2 = createStubRedactor();
    const reparse = hl7v2Walker.parse(once.redacted);
    expect(reparse.parseErrors).toHaveLength(0);
    const twice = hl7v2Walker.redact(reparse.parsed, RULES, stub2);
    // Counters reset across redactor instances, so substitutions match 1:1.
    expect(twice.redacted).toBe(once.redacted);
  });
});
