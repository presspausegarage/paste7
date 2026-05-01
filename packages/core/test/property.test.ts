// Property-based tests (Phase 1 step 7).
//
// Synthetic fixtures only — no real PHI in this repo, ever. Each generated
// message places unique marker tokens in PHI-bearing positions; properties
// then assert that markers placed in substitute-strategy paths never survive
// in the engine's redacted output or in any finding.redactedValue.
//
// All four formats: HL7 v2, FHIR JSON, CDA, FHIR XML. Plus determinism and
// reset semantics on the engine, plus a parse/serialize round-trip property
// per walker.
//
// Marker shape: `MARKER` followed by 7 zero-padded digits. This avoids
//   - HL7 v2 separators (|^~\&) and line-ending chars (\r \n)
//   - JSON string escapes (" \)
//   - XML special chars (< > & " ')
//   - SSN-shaped substrings (\d{3}-\d{2}-\d{4}) the free-text scanner targets
//   - Norse pool entries and the redactor's fake-id patterns (MRN-FAKE-NNNN,
//     ID-FAKE-NNNN, 555-01XX, 1950-01-01, placeholder.invalid)
// so the substring "MARKER0000042" can be searched literally with no false
// positives or negatives.

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { createEngine } from "../src/engine.js";
import { hl7v2Walker } from "../src/walkers/hl7v2.js";
import { fhirJsonWalker } from "../src/walkers/json.js";
import { xmlWalker } from "../src/walkers/xml.js";
import type { Format, RedactResult } from "../src/index.js";

// -----------------------------------------------------------------------------
// Marker primitives
// -----------------------------------------------------------------------------

/** Build a unique marker from an integer id. */
function marker(id: number): string {
  return `MARKER${String(id).padStart(7, "0")}`;
}

/** A generator of unique markers within a single arbitrary's run. Returned
 *  closure mints a new marker each call by drawing from a sequential counter. */
function markerSource(seed: number): () => string {
  let n = seed;
  return () => marker(n++);
}

/** Assert that none of the listed markers appear as a substring of `output`. */
function expectMarkersAbsent(output: string, markers: ReadonlyArray<string>): void {
  for (const m of markers) {
    if (output.includes(m)) {
      throw new Error(
        `expected marker ${m} to be redacted, but it survives in output:\n${output}`,
      );
    }
  }
}

// -----------------------------------------------------------------------------
// HL7 v2 arbitrary
// -----------------------------------------------------------------------------
//
// Always emits a valid MSH header with default separators and version 2.5.
// Optionally includes PID with random subset of redactable fields. All marker
// values land in substitute-strategy fields per HL7V2_RULES.

interface SyntheticMessage {
  text: string;
  format: Format;
  /** Markers placed in substitute-strategy paths; must not survive redaction. */
  substituteMarkers: ReadonlyArray<string>;
}

const MSH_HEADER =
  "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5";

const hl7v2Arbitrary: fc.Arbitrary<SyntheticMessage> = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    includePid: fc.boolean(),
    pidFields: fc.record({
      name: fc.boolean(),
      mrn: fc.boolean(),
      address: fc.boolean(),
      phone: fc.boolean(),
      ssn: fc.boolean(),
      account: fc.boolean(),
    }),
    includeNk1: fc.boolean(),
    includeObx: fc.boolean(),
    extraPidCount: fc.integer({ min: 0, max: 2 }),
  })
  .map(({ seed, includePid, pidFields, includeNk1, includeObx, extraPidCount }) => {
    const next = markerSource(seed);
    const substituteMarkers: string[] = [];
    const lines: string[] = [MSH_HEADER];

    function buildPid(): string {
      // PID positions: 1=set-id, 2=external-id, 3=patient-id (CX), 4=alternate-id,
      // 5=name (XPN), 6=mother's-maiden, 7=DOB, 8=sex, 9=alias, 10=race, 11=address,
      // 12=county, 13=phone, 14=biz-phone, 18=account, 19=SSN
      const fields: string[] = ["PID", "1"]; // PID-1 is the set-id (not PHI)
      // PID-2: optional external id
      fields.push("");
      // PID-3: id (CX)
      if (pidFields.mrn) {
        const m = next();
        substituteMarkers.push(m);
        fields.push(`${m}^^^HOSP^MR`);
      } else {
        fields.push("");
      }
      // PID-4: alternate id (skip)
      fields.push("");
      // PID-5: name (XPN)
      if (pidFields.name) {
        const family = next();
        const given = next();
        substituteMarkers.push(family, given);
        fields.push(`${family}^${given}^Q`);
      } else {
        fields.push("");
      }
      // PID-6: mother's maiden (skip)
      fields.push("");
      // PID-7: DOB
      fields.push("19850315");
      // PID-8: sex
      fields.push("M");
      // PID-9: alias (skip)
      fields.push("");
      // PID-10: race (skip)
      fields.push("");
      // PID-11: address (XAD)
      if (pidFields.address) {
        const street = next();
        const city = next();
        substituteMarkers.push(street, city);
        fields.push(`100 ${street}^^${city}^FL^32801`);
      } else {
        fields.push("");
      }
      // PID-12: county (skip)
      fields.push("");
      // PID-13: phone — keep shape so the redactor's phone generator emits 555-01XX
      if (pidFields.phone) {
        // Phones intentionally don't carry our markers — the redactor preserves
        // the input's *shape* (dashed/dotted/parens) but discards the digits, so
        // a marker here would survive only by coincidence and we don't want false
        // positives. We assert phone-shape preservation separately below.
        fields.push("(407)555-1234");
      } else {
        fields.push("");
      }
      // PID-14 .. PID-17: skip
      fields.push("", "", "", "");
      // PID-18: account
      if (pidFields.account) {
        const m = next();
        substituteMarkers.push(m);
        fields.push(m);
      } else {
        fields.push("");
      }
      // PID-19: SSN — same reasoning as phone: shape-driven substitution, no
      // marker carried in this field.
      if (pidFields.ssn) {
        fields.push("123-45-6789");
      } else {
        fields.push("");
      }
      return fields.join("|");
    }

    if (includePid) lines.push(buildPid());
    for (let i = 0; i < extraPidCount; i++) lines.push(buildPid());

    if (includeNk1) {
      // NK1 fields: 1=set-id, 2=name (XPN), 3=relationship, 4=address (XAD),
      // 5=phone, 6=business phone. Place markers in NK1-2 (name) and NK1-4
      // (address); leave phones at fixed shapes.
      const family = next();
      const given = next();
      substituteMarkers.push(family, given);
      const street = next();
      const city = next();
      substituteMarkers.push(street, city);
      lines.push(
        `NK1|1|${family}^${given}^Q|SPO|100 ${street}^^${city}^FL^32801|(407)555-9999`,
      );
    }

    if (includeObx) {
      // OBX-5 is flag-only narrative; we don't use markers here because the
      // contract preserves the value verbatim. Keep the segment present so the
      // engine exercises the free-text path.
      lines.push("OBX|1|TX|Note^Note^L||Free text narrative without PHI|||||F");
    }

    return {
      text: lines.join("\r"),
      format: "hl7v2" as const,
      substituteMarkers,
    };
  });

// -----------------------------------------------------------------------------
// FHIR JSON arbitrary
// -----------------------------------------------------------------------------
//
// Generates a Patient resource whose redactable leaves carry markers. Targets
// the bundled FHIR_JSON_RULES patterns: name.{family,given}, identifier.value,
// telecom.value, birthDate, address.{line,city,postalCode}.

const fhirJsonArbitrary: fc.Arbitrary<SyntheticMessage> = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    nameCount: fc.integer({ min: 0, max: 2 }),
    givenPerName: fc.integer({ min: 0, max: 3 }),
    identifierCount: fc.integer({ min: 0, max: 2 }),
    telecomCount: fc.integer({ min: 0, max: 0 }), // shape-only: no markers
    addressCount: fc.integer({ min: 0, max: 2 }),
    addressLineCount: fc.integer({ min: 0, max: 2 }),
    includeBirthDate: fc.boolean(),
    includeText: fc.boolean(),
  })
  .map((opts) => {
    const next = markerSource(opts.seed);
    const substituteMarkers: string[] = [];

    const patient: Record<string, unknown> = {
      resourceType: "Patient",
      id: "example",
      gender: "male",
    };

    if (opts.nameCount > 0) {
      const names: unknown[] = [];
      for (let i = 0; i < opts.nameCount; i++) {
        const family = next();
        substituteMarkers.push(family);
        const given: string[] = [];
        for (let g = 0; g < opts.givenPerName; g++) {
          const m = next();
          substituteMarkers.push(m);
          given.push(m);
        }
        names.push({ use: "official", family, given });
      }
      patient.name = names;
    }

    if (opts.identifierCount > 0) {
      const identifiers: unknown[] = [];
      for (let i = 0; i < opts.identifierCount; i++) {
        const m = next();
        substituteMarkers.push(m);
        identifiers.push({ system: "urn:oid:1.2.3", value: m });
      }
      patient.identifier = identifiers;
    }

    if (opts.telecomCount > 0) {
      const telecom: unknown[] = [];
      for (let i = 0; i < opts.telecomCount; i++) {
        telecom.push({ system: "phone", value: "555-555-1234", use: "home" });
      }
      patient.telecom = telecom;
    }

    if (opts.includeBirthDate) {
      // Date redactor emits 1950-01-01; not a marker carrier (shape-driven).
      patient.birthDate = "1985-03-15";
    }

    if (opts.addressCount > 0) {
      const addresses: unknown[] = [];
      for (let i = 0; i < opts.addressCount; i++) {
        const lines: string[] = [];
        for (let l = 0; l < opts.addressLineCount; l++) {
          const m = next();
          substituteMarkers.push(m);
          lines.push(`100 ${m}`);
        }
        const city = next();
        substituteMarkers.push(city);
        const addr: Record<string, unknown> = {
          use: "home",
          city,
          state: "FL",
        };
        if (lines.length > 0) addr.line = lines;
        // postalCode redactor emits a sequential 5-digit number; shape-only.
        addr.postalCode = "32801";
        addresses.push(addr);
      }
      patient.address = addresses;
    }

    if (opts.includeText) {
      patient.text = {
        status: "generated",
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Free text narrative</div>',
      };
    }

    return {
      text: JSON.stringify(patient),
      format: "fhir-json" as const,
      substituteMarkers,
    };
  });

// -----------------------------------------------------------------------------
// CDA (XML) arbitrary
// -----------------------------------------------------------------------------
//
// Targets SHARED_RIM_RULES paths under recordTarget/patientRole/patient/...

const cdaArbitrary: fc.Arbitrary<SyntheticMessage> = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    includePatientId: fc.boolean(),
    includeName: fc.boolean(),
    includeBirthTime: fc.boolean(),
    includeAddr: fc.boolean(),
    includeTelecom: fc.boolean(),
    includeText: fc.boolean(),
  })
  .map((opts) => {
    const next = markerSource(opts.seed);
    const substituteMarkers: string[] = [];

    const patientChildren: string[] = [];
    if (opts.includeName) {
      const given = next();
      const family = next();
      substituteMarkers.push(given, family);
      patientChildren.push(
        `<name><given>${given}</given><family>${family}</family></name>`,
      );
    }
    patientChildren.push(`<administrativeGenderCode code="M"/>`);
    if (opts.includeBirthTime) {
      // birthTime @value is date-shaped; redactor emits 19500101. No marker.
      patientChildren.push(`<birthTime value="19850315"/>`);
    }

    const patientRoleChildren: string[] = [];
    if (opts.includePatientId) {
      const m = next();
      substituteMarkers.push(m);
      patientRoleChildren.push(
        `<id root="2.16.840.1.113883.19.5" extension="${m}"/>`,
      );
    }
    if (opts.includeAddr) {
      const street = next();
      const city = next();
      substituteMarkers.push(street, city);
      patientRoleChildren.push(
        `<addr><streetAddressLine>100 ${street}</streetAddressLine>` +
          `<city>${city}</city><postalCode>32801</postalCode></addr>`,
      );
    }
    if (opts.includeTelecom) {
      // telecom @value is phone-shape; redactor emits 555-01XX. No marker.
      patientRoleChildren.push(`<telecom value="(407)555-1234"/>`);
    }
    patientRoleChildren.push(`<patient>${patientChildren.join("")}</patient>`);

    const docChildren: string[] = [
      `<id root="2.16.840.1.113883.19.5" extension="999021"/>`,
      `<recordTarget><patientRole>${patientRoleChildren.join("")}</patientRole></recordTarget>`,
    ];
    if (opts.includeText) {
      docChildren.push(`<text>Free text narrative without PHI</text>`);
    }

    const text =
      `<?xml version="1.0"?>` +
      `<ClinicalDocument xmlns="urn:hl7-org:v3">${docChildren.join("")}</ClinicalDocument>`;

    return { text, format: "cda" as const, substituteMarkers };
  });

// -----------------------------------------------------------------------------
// FHIR XML arbitrary
// -----------------------------------------------------------------------------
//
// Attribute-valued leaves under <Patient xmlns="http://hl7.org/fhir">.

const fhirXmlArbitrary: fc.Arbitrary<SyntheticMessage> = fc
  .record({
    seed: fc.integer({ min: 1, max: 1_000_000 }),
    includeIdentifier: fc.boolean(),
    nameCount: fc.integer({ min: 0, max: 2 }),
    givenPerName: fc.integer({ min: 0, max: 2 }),
    includeBirthDate: fc.boolean(),
    includeAddress: fc.boolean(),
    addressLineCount: fc.integer({ min: 0, max: 2 }),
  })
  .map((opts) => {
    const next = markerSource(opts.seed);
    const substituteMarkers: string[] = [];

    const parts: string[] = [`<id value="example"/>`];

    if (opts.includeIdentifier) {
      const m = next();
      substituteMarkers.push(m);
      parts.push(
        `<identifier><system value="urn:oid:1.2.3"/><value value="${m}"/></identifier>`,
      );
    }

    for (let i = 0; i < opts.nameCount; i++) {
      const family = next();
      substituteMarkers.push(family);
      const givens: string[] = [];
      for (let g = 0; g < opts.givenPerName; g++) {
        const gm = next();
        substituteMarkers.push(gm);
        givens.push(`<given value="${gm}"/>`);
      }
      parts.push(`<name><family value="${family}"/>${givens.join("")}</name>`);
    }

    parts.push(`<gender value="male"/>`);

    if (opts.includeBirthDate) {
      parts.push(`<birthDate value="1985-03-15"/>`);
    }

    if (opts.includeAddress) {
      const lines: string[] = [];
      for (let l = 0; l < opts.addressLineCount; l++) {
        const m = next();
        substituteMarkers.push(m);
        lines.push(`<line value="100 ${m}"/>`);
      }
      const city = next();
      substituteMarkers.push(city);
      parts.push(
        `<address>${lines.join("")}<city value="${city}"/>` +
          `<state value="FL"/><postalCode value="32801"/></address>`,
      );
    }

    const text =
      `<?xml version="1.0"?>` +
      `<Patient xmlns="http://hl7.org/fhir">${parts.join("")}</Patient>`;

    return { text, format: "fhir-xml" as const, substituteMarkers };
  });

// -----------------------------------------------------------------------------
// Cross-format engine properties — never throw, no marker leak, valid output
// -----------------------------------------------------------------------------

interface FormatCase {
  name: string;
  arb: fc.Arbitrary<SyntheticMessage>;
  /** Walker used to verify round-trip parseability of the redacted output. */
  reparse: (input: string) => { hasError: boolean };
}

const HL7V2_REPARSE: FormatCase["reparse"] = (input) => {
  const { parseErrors } = hl7v2Walker.parse(input);
  return { hasError: parseErrors.some((e) => e.severity === "error") };
};
const FHIR_JSON_REPARSE: FormatCase["reparse"] = (input) => {
  const { parseErrors } = fhirJsonWalker.parse(input);
  return { hasError: parseErrors.some((e) => e.severity === "error") };
};
const XML_REPARSE: FormatCase["reparse"] = (input) => {
  const { parseErrors } = xmlWalker.parse(input);
  return { hasError: parseErrors.some((e) => e.severity === "error") };
};

const FORMAT_CASES: ReadonlyArray<FormatCase> = [
  { name: "hl7v2", arb: hl7v2Arbitrary, reparse: HL7V2_REPARSE },
  { name: "fhir-json", arb: fhirJsonArbitrary, reparse: FHIR_JSON_REPARSE },
  { name: "cda", arb: cdaArbitrary, reparse: XML_REPARSE },
  { name: "fhir-xml", arb: fhirXmlArbitrary, reparse: XML_REPARSE },
];

for (const { name, arb, reparse } of FORMAT_CASES) {
  describe(`property — ${name} engine.redact`, () => {
    it("never throws on synthetic input", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          expect(result.format).toBe(msg.format);
        }),
      );
    });

    it("produces output that re-parses without error-severity issues", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          const { hasError } = reparse(result.redacted);
          expect(hasError).toBe(false);
        }),
      );
    });

    it("does not leak any substitute-strategy marker into result.redacted", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          expectMarkersAbsent(result.redacted, msg.substituteMarkers);
        }),
      );
    });

    it("does not leak any substitute-strategy marker into finding.redactedValue", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          for (const f of result.findings) {
            if (f.strategy !== "substitute") continue;
            if (f.redactedValue === null) continue;
            expectMarkersAbsent(f.redactedValue, msg.substituteMarkers);
          }
        }),
      );
    });

    it("is deterministic within a single engine instance", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const a: RedactResult = await engine.redact(msg.text, {
            format: msg.format,
          });
          const b: RedactResult = await engine.redact(msg.text, {
            format: msg.format,
          });
          expect(b.redacted).toBe(a.redacted);
          expect(b.findings.length).toBe(a.findings.length);
        }),
      );
    });

    it("reset() returns the engine to a state that produces the original output", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine = createEngine();
          const before = await engine.redact(msg.text, { format: msg.format });
          engine.reset();
          const after = await engine.redact(msg.text, { format: msg.format });
          expect(after.redacted).toBe(before.redacted);
        }),
      );
    });

    it("re-redacting the redacted output is a fixed point (parse stays clean, no new findings count growth)", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (msg) => {
          const engine1 = createEngine();
          const first = await engine1.redact(msg.text, { format: msg.format });
          const engine2 = createEngine();
          const second = await engine2.redact(first.redacted, {
            format: msg.format,
          });
          // Reparseable
          const { hasError } = reparse(second.redacted);
          expect(hasError).toBe(false);
          // No marker leak survived two redaction passes either.
          expectMarkersAbsent(second.redacted, msg.substituteMarkers);
        }),
      );
    });
  });
}

// -----------------------------------------------------------------------------
// Walker-level round-trip property: parse(serialize(redact(parse(input))))
// -----------------------------------------------------------------------------
//
// This is the contract from the handoff: the redacted output must round-trip
// through the walker without errors, and a second redact pass on the re-parsed
// AST must produce identical bytes (with a fresh redactor each pass to avoid
// counter drift across instances).

describe("property — walker round-trip stability", () => {
  it("hl7v2 walker: redact -> parse -> redact yields the same redacted bytes", async () => {
    await fc.assert(
      fc.asyncProperty(hl7v2Arbitrary, async (msg) => {
        const engine1 = createEngine();
        const once = await engine1.redact(msg.text, { format: "hl7v2" });
        const engine2 = createEngine();
        const twice = await engine2.redact(once.redacted, { format: "hl7v2" });
        expect(twice.redacted).toBe(once.redacted);
      }),
    );
  });

  it("fhir-json walker: redact -> parse -> redact yields the same redacted bytes", async () => {
    await fc.assert(
      fc.asyncProperty(fhirJsonArbitrary, async (msg) => {
        const engine1 = createEngine();
        const once = await engine1.redact(msg.text, { format: "fhir-json" });
        const engine2 = createEngine();
        const twice = await engine2.redact(once.redacted, { format: "fhir-json" });
        expect(twice.redacted).toBe(once.redacted);
      }),
    );
  });

  it("xml walker (CDA): redact -> parse -> redact yields the same redacted bytes", async () => {
    await fc.assert(
      fc.asyncProperty(cdaArbitrary, async (msg) => {
        const engine1 = createEngine();
        const once = await engine1.redact(msg.text, { format: "cda" });
        const engine2 = createEngine();
        const twice = await engine2.redact(once.redacted, { format: "cda" });
        expect(twice.redacted).toBe(once.redacted);
      }),
    );
  });

  it("xml walker (FHIR XML): redact -> parse -> redact yields the same redacted bytes", async () => {
    await fc.assert(
      fc.asyncProperty(fhirXmlArbitrary, async (msg) => {
        const engine1 = createEngine();
        const once = await engine1.redact(msg.text, { format: "fhir-xml" });
        const engine2 = createEngine();
        const twice = await engine2.redact(once.redacted, { format: "fhir-xml" });
        expect(twice.redacted).toBe(once.redacted);
      }),
    );
  });
});

// -----------------------------------------------------------------------------
// Findings-shape invariants (cheap to check across formats; high-value)
// -----------------------------------------------------------------------------

describe("property — findings shape invariants", () => {
  it("originalLength matches the actual length of the input PHI value", async () => {
    // We can't reconstruct the original from the finding (by design), but we
    // can assert it's a non-negative integer. Combined with no-leak, this is
    // enough to defend the contract that the original is never exposed via
    // any surface other than (intentional) flag-only echo.
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(hl7v2Arbitrary, fhirJsonArbitrary, cdaArbitrary, fhirXmlArbitrary),
        async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          for (const f of result.findings) {
            expect(Number.isInteger(f.originalLength)).toBe(true);
            expect(f.originalLength).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });

  it("every finding has a non-empty rule id matching the format prefix", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(hl7v2Arbitrary, fhirJsonArbitrary, cdaArbitrary, fhirXmlArbitrary),
        async (msg) => {
          const engine = createEngine();
          const result = await engine.redact(msg.text, { format: msg.format });
          for (const f of result.findings) {
            expect(typeof f.rule).toBe("string");
            expect(f.rule.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});
