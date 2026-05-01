// Format detection. See docs/engine-contract.md sections 1 (signals) and 11 (error handling).

import type { Format, FormatDetection } from "./types.js";

interface FormatScore {
  format: Format;
  confidence: number;
}

export function detectFormat(input: string): FormatDetection {
  const cleaned = input.replace(/^﻿/, "").trim();
  if (cleaned.length === 0) {
    return { format: "hl7v2", confidence: 0, alternatives: [] };
  }

  const scores: FormatScore[] = [
    ...scoreHL7v2(cleaned),
    ...scoreFHIRJson(cleaned),
    ...scoreXmlFormats(cleaned),
  ].filter((s) => s.confidence > 0);

  scores.sort((a, b) => b.confidence - a.confidence);

  if (scores.length === 0) {
    return { format: "hl7v2", confidence: 0, alternatives: [] };
  }

  const top = scores[0]!;
  const rest = scores.slice(1);
  return {
    format: top.format,
    confidence: top.confidence,
    alternatives: rest,
  };
}

function scoreHL7v2(input: string): FormatScore[] {
  const firstLine = input.split(/\r?\n/, 1)[0]?.trim() ?? "";

  if (firstLine.startsWith("MSH|")) {
    // MSH|^~\&|... — encoding-chars block follows the field separator
    if (firstLine.length >= 8) {
      return [{ format: "hl7v2", confidence: 0.95 }];
    }
    return [{ format: "hl7v2", confidence: 0.7 }];
  }

  // Segment list without MSH (partial paste); 3-char segment + field separator
  if (/^[A-Z][A-Z0-9]{2}\|/.test(firstLine)) {
    return [{ format: "hl7v2", confidence: 0.5 }];
  }

  return [];
}

function scoreFHIRJson(input: string): FormatScore[] {
  if (!input.startsWith("{") && !input.startsWith("[")) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.resourceType === "string") {
      return [{ format: "fhir-json", confidence: 0.95 }];
    }
    if (Array.isArray(parsed)) {
      const hasFHIREntry = parsed.some(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).resourceType === "string",
      );
      if (hasFHIREntry) {
        return [{ format: "fhir-json", confidence: 0.7 }];
      }
    }
    return [{ format: "fhir-json", confidence: 0.05 }];
  }

  return [];
}

function scoreXmlFormats(input: string): FormatScore[] {
  if (!input.startsWith("<")) {
    return [];
  }

  const afterDecl = input.replace(/^<\?xml\b[^?]*\?>\s*/i, "");
  const rootMatch = /^<([a-zA-Z][\w.-]*(?::[a-zA-Z][\w.-]*)?)([^>]*)>/.exec(
    afterDecl,
  );
  if (!rootMatch) {
    return [];
  }

  const rootElement = rootMatch[1] ?? "";
  const rootAttrs = rootMatch[2] ?? "";
  const localName = rootElement.includes(":")
    ? (rootElement.split(":")[1] ?? rootElement)
    : rootElement;

  const xmlnsMatch = /\bxmlns(?::\w+)?\s*=\s*"([^"]*)"/.exec(rootAttrs);
  const namespace = xmlnsMatch?.[1] ?? "";

  const scores: FormatScore[] = [];

  if (localName === "ClinicalDocument") {
    if (namespace.includes("urn:hl7-org:v3")) {
      scores.push({ format: "cda", confidence: 0.95 });
    } else {
      scores.push({ format: "cda", confidence: 0.7 });
    }
  }

  if (
    namespace.includes("urn:hl7-org:v3") &&
    localName !== "ClinicalDocument"
  ) {
    scores.push({ format: "hl7v3", confidence: 0.85 });
  }

  if (namespace.includes("http://hl7.org/fhir")) {
    scores.push({ format: "fhir-xml", confidence: 0.95 });
  }

  if (scores.length === 0 && FHIR_RESOURCE_NAMES.has(localName)) {
    scores.push({ format: "fhir-xml", confidence: 0.6 });
  }

  if (scores.length === 0) {
    scores.push({ format: "fhir-xml", confidence: 0.05 });
  }

  return scores;
}

// Common FHIR resource names; used as a low-confidence fallback when the XML
// root has no namespace declaration. Not exhaustive — full list lives in the
// FHIR R4/R5 label dictionaries (Phase 1 step 6).
const FHIR_RESOURCE_NAMES: ReadonlySet<string> = new Set([
  "Patient",
  "Practitioner",
  "PractitionerRole",
  "RelatedPerson",
  "Person",
  "Organization",
  "Location",
  "Encounter",
  "Observation",
  "Condition",
  "Procedure",
  "DiagnosticReport",
  "MedicationRequest",
  "MedicationStatement",
  "MedicationAdministration",
  "AllergyIntolerance",
  "Immunization",
  "CarePlan",
  "Goal",
  "Bundle",
  "Composition",
  "DocumentReference",
  "Coverage",
  "Claim",
  "ExplanationOfBenefit",
  "ServiceRequest",
  "Appointment",
  "Schedule",
  "Slot",
]);
