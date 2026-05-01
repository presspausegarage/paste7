import { describe, expect, it } from "vitest";
import {
  getHL7v2Label,
  detectHL7v2Version,
  getFHIRLabel,
  detectFHIRVersion,
  getCDALabel,
} from "../src/labels/index.js";
import { createEngine } from "../src/engine.js";

// -----------------------------------------------------------------------------
// HL7 v2 label resolver
// -----------------------------------------------------------------------------

describe("HL7 v2 label resolver", () => {
  it("resolves segment label", () => {
    expect(getHL7v2Label("PID")).toBe("Patient Identification");
    expect(getHL7v2Label("MSH")).toBe("Message Header");
    expect(getHL7v2Label("OBX")).toBe("Observation/Result");
  });

  it("resolves field label", () => {
    expect(getHL7v2Label("PID-5")).toBe("Patient Name");
    expect(getHL7v2Label("PID-7")).toBe("Date/Time of Birth");
    expect(getHL7v2Label("PID-3")).toBe("Patient Identifier List");
  });

  it("annotates component path with field label + position", () => {
    const label = getHL7v2Label("PID-5.1");
    expect(label).toContain("Patient Name");
    expect(label).toContain("component 1");
  });

  it("annotates subcomponent path", () => {
    const label = getHL7v2Label("PID-5.1.2");
    expect(label).toContain("Patient Name");
    expect(label).toContain("component 1");
    expect(label).toContain("subcomponent 2");
  });

  it("falls back to path on unknown segment", () => {
    expect(getHL7v2Label("ZXX")).toBe("ZXX");
    expect(getHL7v2Label("ZXX-3")).toBe("ZXX-3");
  });

  it("respects version override", () => {
    // PID-7 description is consistent across v2.5 and v2.7; pick a field that
    // has any description in both, just confirm the call accepts a version.
    expect(getHL7v2Label("PID-7", "2.5")).toBe(getHL7v2Label("PID-7", "2.7"));
  });

  it("falls back to default version on unknown version string", () => {
    // "9.99" doesn't exist; should still resolve via default fallback.
    expect(getHL7v2Label("PID-5", "9.99")).toBe("Patient Name");
  });

  it("downgrades to closest supported when version is partial match", () => {
    // "2.5.2" doesn't exist; resolver should downgrade to 2.5.1 or 2.5.
    expect(getHL7v2Label("PID-5", "2.5.2")).toBe("Patient Name");
  });
});

describe("HL7 v2 detectVersion", () => {
  it("reads MSH-12 from a complete MSH line", () => {
    const msh =
      "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5";
    expect(detectHL7v2Version(msh)).toBe("2.5");
  });

  it("returns undefined on missing MSH or short line", () => {
    expect(detectHL7v2Version(undefined)).toBeUndefined();
    expect(detectHL7v2Version("MSH|too|short")).toBeUndefined();
  });

  it("strips composite VID type to primary version", () => {
    const msh =
      "MSH|^~\\&|A|B|C|D|20240115||ADT^A01|1|P|2.5.1^international^2.5.1";
    expect(detectHL7v2Version(msh)).toBe("2.5.1");
  });
});

// -----------------------------------------------------------------------------
// FHIR label resolver
// -----------------------------------------------------------------------------

describe("FHIR label resolver", () => {
  it("resolves resource roots", () => {
    expect(getFHIRLabel("Patient")).toBe("Patient");
    expect(getFHIRLabel("Practitioner")).toBe("Practitioner");
    expect(getFHIRLabel("Bundle")).toBe("Bundle");
  });

  it("resolves common navigation properties", () => {
    expect(getFHIRLabel("Patient.resourceType")).toBe("Resource Type");
    expect(getFHIRLabel("Patient.id")).toBe("Resource ID");
    expect(getFHIRLabel("Bundle.entry")).toBe("Bundle Entry");
  });

  it("resolves HumanName fields by property fragment", () => {
    expect(getFHIRLabel("Patient.name[0].family")).toBe("Family Name");
    expect(getFHIRLabel("Patient.name[0].given[0]")).toBe("Given Name");
  });

  it("resolves Identifier fields across resources", () => {
    expect(getFHIRLabel("Patient.identifier[0].value")).toBe("Identifier");
    expect(
      getFHIRLabel("Bundle.entry[0].resource.identifier[2].value"),
    ).toBe("Identifier");
  });

  it("resolves Address fields", () => {
    expect(getFHIRLabel("Patient.address[0].line[0]")).toBe("Street Line");
    expect(getFHIRLabel("Patient.address[0].city")).toBe("City");
    expect(getFHIRLabel("Patient.address[0].postalCode")).toBe("Postal Code");
  });

  it("resolves dates", () => {
    expect(getFHIRLabel("Patient.birthDate")).toBe("Date of Birth");
    expect(getFHIRLabel("Patient.deceasedDateTime")).toBe("Date of Death");
  });

  it("falls back to path on unknown deep paths", () => {
    expect(getFHIRLabel("Patient.exotic.unknown.path")).toBe(
      "Patient.exotic.unknown.path",
    );
  });
});

describe("FHIR detectVersion", () => {
  it("defaults to R4 when no profile hint is present", () => {
    expect(detectFHIRVersion({ resourceType: "Patient" })).toBe("R4");
  });

  it("detects R5 from meta.profile URL", () => {
    expect(
      detectFHIRVersion({
        resourceType: "Patient",
        meta: { profile: ["http://hl7.org/fhir/R5/StructureDefinition/Patient"] },
      }),
    ).toBe("R5");
  });

  it("returns undefined for non-objects", () => {
    expect(detectFHIRVersion(null)).toBeUndefined();
    expect(detectFHIRVersion("string")).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// CDA / HL7 v3 label resolver
// -----------------------------------------------------------------------------

describe("CDA label resolver", () => {
  it("resolves CDA root + section labels", () => {
    expect(getCDALabel("/ClinicalDocument")).toBe("Clinical Document");
    expect(
      getCDALabel("/ClinicalDocument/recordTarget/patientRole/patient"),
    ).toBe("Patient");
  });

  it("resolves name fields by trailing element", () => {
    expect(
      getCDALabel(
        "/ClinicalDocument/recordTarget/patientRole/patient/name/given",
      ),
    ).toBe("Given Name");
    expect(
      getCDALabel(
        "/ClinicalDocument/recordTarget/patientRole/patient/name/family",
      ),
    ).toBe("Family Name");
  });

  it("resolves attribute labels via @prefix", () => {
    expect(
      getCDALabel("/ClinicalDocument/recordTarget/patientRole/id/@extension"),
    ).toBe("Identifier Extension");
    expect(
      getCDALabel(
        "/ClinicalDocument/recordTarget/patientRole/patient/birthTime/@value",
      ),
    ).toBe("Value");
  });

  it("falls back to path on unknown elements", () => {
    expect(getCDALabel("/ClinicalDocument/exotic/unknown")).toBe(
      "/ClinicalDocument/exotic/unknown",
    );
  });
});

// -----------------------------------------------------------------------------
// End-to-end via engine — verify TokenTree carries human labels
// -----------------------------------------------------------------------------

describe("engine — labels in TokenTree", () => {
  it("HL7 v2 PID-5 node label = 'Patient Name'", async () => {
    const msg =
      "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|MSGID-001|P|2.5\r" +
      "PID|1||MRN12345||DOE^JOHN||19850315|M";
    const engine = createEngine();
    const result = await engine.redact(msg);
    const pidNode = result.tree.nodes.find((n) => n.path === "PID")!;
    expect(pidNode.label).toBe("Patient Identification");
    const pid5 = pidNode.children!.find((c) => c.path === "PID-5")!;
    expect(pid5.label).toBe("Patient Name");
    const pid7 = pidNode.children!.find((c) => c.path === "PID-7")!;
    expect(pid7.label).toBe("Date/Time of Birth");
  });

  it("FHIR JSON Patient.name[0].family node label = 'Family Name'", async () => {
    const json = JSON.stringify({
      resourceType: "Patient",
      id: "ex",
      name: [{ family: "Doe", given: ["John"] }],
      birthDate: "1985-03-15",
    });
    const engine = createEngine();
    const result = await engine.redact(json);
    const root = result.tree.nodes[0]!;
    expect(root.label).toBe("Patient");
    const family = findByPath(root, "Patient.name[0].family")!;
    expect(family.label).toBe("Family Name");
    const given = findByPath(root, "Patient.name[0].given[0]")!;
    expect(given.label).toBe("Given Name");
    const dob = findByPath(root, "Patient.birthDate")!;
    expect(dob.label).toBe("Date of Birth");
  });

  it("CDA family element node label = 'Family Name'", async () => {
    const cda =
      `<?xml version="1.0"?>` +
      `<ClinicalDocument xmlns="urn:hl7-org:v3">` +
      `<recordTarget><patientRole>` +
      `<id root="2.16.840.1.113883.19.5" extension="MRN12345"/>` +
      `<patient><name><given>John</given><family>Doe</family></name></patient>` +
      `</patientRole></recordTarget>` +
      `</ClinicalDocument>`;
    const engine = createEngine();
    const result = await engine.redact(cda);
    const family = findByPath(
      result.tree.nodes[0]!,
      "/ClinicalDocument/recordTarget/patientRole/patient/name/family",
    )!;
    expect(family.label).toBe("Family Name");
  });
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface AnyNode {
  path: string;
  label: string;
  kind: string;
  value?: string | null;
  children?: ReadonlyArray<AnyNode>;
}

function findByPath(root: AnyNode, target: string): AnyNode | undefined {
  if (root.path === target) return root;
  if (!root.children) return undefined;
  for (const c of root.children) {
    const hit = findByPath(c, target);
    if (hit) return hit;
  }
  return undefined;
}
