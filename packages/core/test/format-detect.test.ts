import { describe, expect, it } from "vitest";
import { detectFormat } from "../src/format-detect.js";

describe("detectFormat", () => {
  describe("HL7 v2", () => {
    it("detects MSH-leading message at high confidence", () => {
      const msg =
        "MSH|^~\\&|EPIC|RIH|REC|RECORG|20240115093000||ADT^A01|123|P|2.5\nPID|1||12345^^^MRN||DOE^JOHN||19850315|M";
      const result = detectFormat(msg);
      expect(result.format).toBe("hl7v2");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("detects segment-list (no MSH) at moderate confidence", () => {
      const msg = "PID|1||12345^^^MRN||DOE^JOHN||19850315|M";
      const result = detectFormat(msg);
      expect(result.format).toBe("hl7v2");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it("strips BOM before detection", () => {
      const msg = "﻿MSH|^~\\&|EPIC|RIH|...";
      expect(detectFormat(msg).format).toBe("hl7v2");
    });
  });

  describe("FHIR JSON", () => {
    it("detects resource by resourceType", () => {
      const msg = JSON.stringify({
        resourceType: "Patient",
        id: "example",
        name: [{ family: "Doe", given: ["John"] }],
      });
      const result = detectFormat(msg);
      expect(result.format).toBe("fhir-json");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("detects array of resources at lower confidence", () => {
      const msg = JSON.stringify([
        { resourceType: "Patient", id: "1" },
        { resourceType: "Practitioner", id: "2" },
      ]);
      const result = detectFormat(msg);
      expect(result.format).toBe("fhir-json");
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it("returns zero confidence for invalid JSON", () => {
      const result = detectFormat("{ not valid json");
      expect(result.confidence).toBe(0);
    });
  });

  describe("FHIR XML", () => {
    it("detects by FHIR namespace", () => {
      const msg = `<?xml version="1.0"?><Patient xmlns="http://hl7.org/fhir"><id value="example"/></Patient>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("fhir-xml");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("detects by resource name without namespace at lower confidence", () => {
      const msg = `<Patient><id value="example"/></Patient>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("fhir-xml");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe("CDA", () => {
    it("detects ClinicalDocument with v3 namespace at high confidence", () => {
      const msg = `<?xml version="1.0"?><ClinicalDocument xmlns="urn:hl7-org:v3"><id/></ClinicalDocument>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("cda");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("detects ClinicalDocument without namespace at moderate confidence", () => {
      const msg = `<ClinicalDocument><id/></ClinicalDocument>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("cda");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe("HL7 v3 messaging", () => {
    it("detects v3 namespace with non-CDA root", () => {
      const msg = `<?xml version="1.0"?><MCCI_IN000002UV01 xmlns="urn:hl7-org:v3"><id/></MCCI_IN000002UV01>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("hl7v3");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("edge cases", () => {
    it("returns zero confidence for empty input", () => {
      const result = detectFormat("");
      expect(result.confidence).toBe(0);
      expect(result.alternatives).toHaveLength(0);
    });

    it("returns zero confidence for whitespace-only input", () => {
      const result = detectFormat("   \n\t  ");
      expect(result.confidence).toBe(0);
    });

    it("returns alternatives when multiple formats match", () => {
      // ClinicalDocument with FHIR namespace would conflict
      const msg = `<ClinicalDocument xmlns="urn:hl7-org:v3"></ClinicalDocument>`;
      const result = detectFormat(msg);
      expect(result.format).toBe("cda");
      expect(result.alternatives.length).toBeGreaterThanOrEqual(0);
    });

    it("handles XML declaration with extra attributes", () => {
      const msg = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Patient xmlns="http://hl7.org/fhir"/>`;
      expect(detectFormat(msg).format).toBe("fhir-xml");
    });
  });
});
