import { describe, expect, it } from "vitest";
import { createRedactor } from "../src/redact.js";
import { DEFAULT_POOL } from "../src/identities.js";
import type { PHICategory, RedactStrategy } from "../src/index.js";

function req(
  category: PHICategory,
  value: string,
  strategy: RedactStrategy = "substitute",
  path = "TEST",
  rule = "test/rule",
) {
  return { category, value, strategy, path, rule };
}

// -----------------------------------------------------------------------------
// Strategy dispatch
// -----------------------------------------------------------------------------

describe("redactor — strategy dispatch", () => {
  it("substitute returns a non-empty fake", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "DOE^JOHN^Q"));
    expect(out.value).not.toBeNull();
    expect(out.value).not.toBe("");
    expect(out.value).not.toBe("DOE^JOHN^Q");
  });

  it("scrub returns [REDACTED]", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "DOE", "scrub"));
    expect(out.value).toBe("[REDACTED]");
  });

  it("flag-only echoes the input value", () => {
    const r = createRedactor();
    const out = r.apply(req("free-text", "narrative content", "flag-only"));
    expect(out.value).toBe("narrative content");
  });

  it("remove returns null", () => {
    const r = createRedactor();
    const out = r.apply(req("photo", "<base64>", "remove"));
    expect(out.value).toBeNull();
  });

  it("emits a finding with originalLength matching the input", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "Doe"));
    expect(out.finding.originalLength).toBe(3);
    expect(out.finding.category).toBe("name");
    expect(out.finding.confidence).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// Cross-message consistency (binding map)
// -----------------------------------------------------------------------------

describe("redactor — bindings", () => {
  it("returns the same fake for the same input across calls (substitute)", () => {
    const r = createRedactor();
    const a = r.apply(req("name", "DOE^JOHN"));
    const b = r.apply(req("name", "DOE^JOHN"));
    expect(b.value).toBe(a.value);
  });

  it("uses different bindings for different categories with same value", () => {
    const r = createRedactor();
    const a = r.apply(req("id", "12345"));
    const b = r.apply(req("name", "12345"));
    expect(a.value).not.toBe(b.value);
  });

  it("reset() clears bindings", () => {
    const r = createRedactor();
    const before = r.apply(req("name", "DOE^JOHN")).value;
    r.reset();
    const after = r.apply(req("name", "DOE^JOHN")).value;
    // Counters reset, so first allocation lands on the same pool entry.
    expect(after).toBe(before);
    // Different value re-uses the just-allocated binding (THUNDERER^THOR).
    const second = r.apply(req("name", "DOE^JOHN")).value;
    expect(second).toBe(after);
  });
});

// -----------------------------------------------------------------------------
// Name substitution shape
// -----------------------------------------------------------------------------

describe("redactor — name substitution", () => {
  it("HL7 XPN: emits FAMILY^GIVEN structure", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "DOE^JOHN")).value!;
    expect(out).toMatch(/^[A-Z_0-9]+\^[A-Z_0-9]+$/);
    const [family, given] = out.split("^");
    expect(family).toBe(DEFAULT_POOL.names[0]!.family);
    expect(given).toBe(DEFAULT_POOL.names[0]!.given);
  });

  it("HL7 XPN with middle: emits FAMILY^GIVEN^M", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "DOE^JOHN^Q")).value!;
    const parts = out.split("^");
    expect(parts).toHaveLength(3);
    expect(parts[2]!.length).toBeLessThanOrEqual(2);
  });

  it("preserves empty trailing components", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "DOE^^^JR")).value!;
    expect(out.split("^")).toHaveLength(4);
  });

  it("single-token name returns family component only (no caret)", () => {
    const r = createRedactor();
    const out = r.apply(req("name", "Doe")).value!;
    expect(out).not.toContain("^");
    expect(out).toBe(DEFAULT_POOL.names[0]!.family);
  });

  it("wraps with numeric suffix when pool exhausted", () => {
    const r = createRedactor();
    // Allocate one full pool of unique values, then one more.
    for (let i = 0; i < DEFAULT_POOL.names.length; i++) {
      r.apply(req("name", `unique-${i}`));
    }
    const wrap = r.apply(req("name", "unique-wrap")).value!;
    expect(wrap).toMatch(/_2$/);
  });
});

// -----------------------------------------------------------------------------
// ID substitution shape
// -----------------------------------------------------------------------------

describe("redactor — id substitution", () => {
  it("SSN-shaped input maps to NANP-invalid SSN format", () => {
    const r = createRedactor();
    const out = r.apply(req("id", "123-45-6789")).value!;
    expect(out).toMatch(/^000-00-\d{4}$/);
  });

  it("MRN-shaped input maps to MRN-FAKE-NNNN", () => {
    const r = createRedactor();
    const out = r.apply(req("id", "MRN12345")).value!;
    expect(out).toMatch(/^MRN-FAKE-\d{4}$/);
  });

  it("digit-string MRN", () => {
    const r = createRedactor();
    const out = r.apply(req("id", "12345")).value!;
    expect(out).toMatch(/^MRN-FAKE-\d{4}$/);
  });

  it("non-MRN-non-SSN id maps to ID-FAKE-NNNN", () => {
    const r = createRedactor();
    const out = r.apply(req("id", "ACCT-X1Y9")).value!;
    expect(out).toMatch(/^ID-FAKE-\d{4}$/);
  });

  it("counters increment per type, not globally", () => {
    const r = createRedactor();
    const ssn1 = r.apply(req("id", "111-22-3333")).value!;
    const ssn2 = r.apply(req("id", "222-33-4444")).value!;
    const mrn1 = r.apply(req("id", "MRN999")).value!;
    expect(ssn1).toMatch(/^000-00-0001$/);
    expect(ssn2).toMatch(/^000-00-0002$/);
    expect(mrn1).toMatch(/^MRN-FAKE-0001$/);
  });
});

// -----------------------------------------------------------------------------
// Phone / email / date / address shapes
// -----------------------------------------------------------------------------

describe("redactor — other formats", () => {
  it("phone preserves input shape (parens, dashes, dots, plus-prefix)", () => {
    const r = createRedactor();
    const dashed = r.apply(req("phone", "407-555-1234")).value!;
    expect(dashed).toMatch(/^555-555-\d{4}$/);
    const dotted = r.apply(req("phone", "407.555.1234")).value!;
    expect(dotted).toMatch(/^555\.555\.\d{4}$/);
    const parens = r.apply(req("phone", "(407) 555-1234")).value!;
    expect(parens).toMatch(/^\(555\) 555-\d{4}$/);
  });

  it("email always becomes user-NNNN@placeholder.invalid", () => {
    const r = createRedactor();
    const out = r.apply(req("email", "john.doe@example.com")).value!;
    expect(out).toMatch(/^user-\d{4}@placeholder\.invalid$/);
  });

  it("date HL7 format (YYYYMMDD) → 19500101", () => {
    const r = createRedactor();
    expect(r.apply(req("date", "19850315")).value).toBe("19500101");
  });

  it("date HL7 with time → 19500101000000", () => {
    const r = createRedactor();
    expect(r.apply(req("date", "20240115093000")).value).toBe("19500101000000");
  });

  it("date ISO YYYY-MM-DD → 1950-01-01", () => {
    const r = createRedactor();
    expect(r.apply(req("date", "1985-03-15")).value).toBe("1950-01-01");
  });

  it("date ISO with Z → 1950-01-01T00:00:00Z", () => {
    const r = createRedactor();
    expect(r.apply(req("date", "1985-03-15T10:30:00Z")).value).toBe(
      "1950-01-01T00:00:00Z",
    );
  });

  it("address with carets emits HL7 XAD shape", () => {
    const r = createRedactor();
    const out = r.apply(
      req("address", "100 MAIN ST^^ORLANDO^FL^32801"),
    ).value!;
    const parts = out.split("^");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(DEFAULT_POOL.streetAddresses[0]);
    expect(parts[1]).toBe("");
    expect(parts[2]).toBe(DEFAULT_POOL.cities[0]);
    expect(parts[3]).toBe("XX");
    expect(parts[4]).toMatch(/^\d{5}$/);
  });

  it("address single 5-digit zip → fake 5-digit zip", () => {
    const r = createRedactor();
    const out = r.apply(req("address", "32801")).value!;
    expect(out).toMatch(/^\d{5}$/);
    expect(out).not.toBe("32801");
  });

  it("address 2-letter state → XX", () => {
    const r = createRedactor();
    expect(r.apply(req("address", "FL")).value).toBe("XX");
  });

  it("address street-like → themed street entry", () => {
    const r = createRedactor();
    expect(r.apply(req("address", "100 Main St")).value).toBe(
      DEFAULT_POOL.streetAddresses[0],
    );
  });

  it("address city-like → themed city entry", () => {
    const r = createRedactor();
    expect(r.apply(req("address", "Orlando")).value).toBe(
      DEFAULT_POOL.cities[0],
    );
  });

  it("geo → 0.0,0.0", () => {
    const r = createRedactor();
    expect(r.apply(req("geo", "28.5383,-81.3792")).value).toBe("0.0,0.0");
  });

  it("device-id → DEV-FAKE-NNNN", () => {
    const r = createRedactor();
    expect(r.apply(req("device-id", "GE-MR-12345")).value).toMatch(
      /^DEV-FAKE-\d{4}$/,
    );
  });

  it("url → placeholder.invalid path", () => {
    const r = createRedactor();
    expect(r.apply(req("url", "https://hospital.example.com/p/123")).value).toMatch(
      /^https:\/\/placeholder\.invalid\/r\/\d{4}$/,
    );
  });

  it("biometric/photo with substitute fall through to scrub", () => {
    const r = createRedactor();
    expect(r.apply(req("biometric", "fingerprint-data")).value).toBe(
      "[REDACTED]",
    );
    expect(r.apply(req("photo", "base64...")).value).toBe("[REDACTED]");
  });
});

// -----------------------------------------------------------------------------
// Free-text scanning
// -----------------------------------------------------------------------------

describe("redactor — free-text scanner", () => {
  it("flags SSN in narrative", () => {
    const r = createRedactor();
    const findings = r.scanFreeText({
      value: "Patient SSN is 123-45-6789 on file",
      path: "OBX-5",
      rule: "hl7v2/OBX-5",
    });
    const ssnFinding = findings.find((f) => f.category === "id");
    expect(ssnFinding).toBeDefined();
    expect(ssnFinding!.confidence).toBeLessThan(1);
    expect(ssnFinding!.redactedValue).toBe("123-45-6789");
  });

  it("flags phone in narrative", () => {
    const r = createRedactor();
    const findings = r.scanFreeText({
      value: "Reach the patient at 407-555-1234 anytime",
      path: "narrative",
      rule: "x/narrative",
    });
    expect(findings.some((f) => f.category === "phone")).toBe(true);
  });

  it("flags email in narrative", () => {
    const r = createRedactor();
    const findings = r.scanFreeText({
      value: "Contact: john.doe@example.com",
      path: "narrative",
      rule: "x/narrative",
    });
    expect(findings.some((f) => f.category === "email")).toBe(true);
  });

  it("emits multiple findings for multiple matches in one input", () => {
    const r = createRedactor();
    const findings = r.scanFreeText({
      value: "SSN 111-22-3333 and SSN 444-55-6666 same patient",
      path: "narrative",
      rule: "x",
    });
    expect(findings.filter((f) => f.category === "id")).toHaveLength(2);
  });

  it("returns empty for clean narrative", () => {
    const r = createRedactor();
    const findings = r.scanFreeText({
      value: "Patient is doing well per follow-up assessment.",
      path: "narrative",
      rule: "x",
    });
    expect(findings).toHaveLength(0);
  });
});
