// FHIR label resolver. Hand-curated label map covering the rule-pack-targeted
// paths plus common navigation properties. Vendored R4/R5 StructureDefinition
// extracts may replace this in a future iteration; for now the curated map
// covers what the bundled rule packs actually match plus the common Patient/
// Practitioner/RelatedPerson/Bundle structure.
//
// Resolution strategy (in order):
//   1. Exact full-path match (e.g. "Patient.name[0].family")
//   2. Property-name match by stripping resource prefix and array indices
//      (e.g. "Patient.name[0].family" → "name.family" → label)
//   3. Last-segment match (e.g. "...family" → "family" → "Family Name")
//   4. Fall back to the input path
//
// Both R4 and R5 resolve through the same map for now — the structure FHIR R5
// added/changed at the property-naming level (vs StructureDefinition shape) is
// tiny relative to the redaction-relevant fields. Diverge if/when needed.

const PROPERTY_LABELS: Readonly<Record<string, string>> = {
  // Resource roots (used as the path root by the JSON walker)
  Patient: "Patient",
  Practitioner: "Practitioner",
  PractitionerRole: "Practitioner Role",
  RelatedPerson: "Related Person",
  Person: "Person",
  Organization: "Organization",
  Coverage: "Coverage Resource",
  Bundle: "Bundle",
  Composition: "Composition",
  DocumentReference: "Document Reference",
  Encounter: "Encounter",
  Condition: "Condition",
  Observation: "Observation",
  DiagnosticReport: "Diagnostic Report",
  Procedure: "Procedure",
  MedicationRequest: "Medication Request",
  Immunization: "Immunization",
  AllergyIntolerance: "Allergy or Intolerance",

  // Navigation properties
  resourceType: "Resource Type",
  id: "Resource ID",
  meta: "Resource Metadata",
  text: "Narrative",
  contained: "Contained Resource",
  extension: "Extension",
  modifierExtension: "Modifier Extension",
  entry: "Bundle Entry",
  resource: "Resource",
  fullUrl: "Full URL",
  request: "Request",
  response: "Response",

  // HumanName
  "name.use": "Name Use",
  "name.text": "Full Name",
  "name.family": "Family Name",
  "name.given": "Given Name",
  "name.prefix": "Name Prefix",
  "name.suffix": "Name Suffix",
  "name.period": "Name Period",

  // Identifier
  "identifier.use": "Identifier Use",
  "identifier.type": "Identifier Type",
  "identifier.system": "Identifier System",
  "identifier.value": "Identifier",
  "identifier.period": "Identifier Period",
  "identifier.assigner": "Identifier Assigner",

  // ContactPoint (telecom)
  "telecom.system": "Contact System",
  "telecom.value": "Contact",
  "telecom.use": "Contact Use",
  "telecom.rank": "Contact Rank",
  "telecom.period": "Contact Period",

  // Address
  "address.use": "Address Use",
  "address.type": "Address Type",
  "address.text": "Full Address",
  "address.line": "Street Line",
  "address.city": "City",
  "address.district": "District",
  "address.state": "State",
  "address.postalCode": "Postal Code",
  "address.country": "Country",
  "address.period": "Address Period",

  // Patient-specific
  birthDate: "Date of Birth",
  deceasedBoolean: "Deceased",
  deceasedDateTime: "Date of Death",
  gender: "Gender",
  active: "Active",
  maritalStatus: "Marital Status",
  multipleBirthBoolean: "Multiple Birth",
  multipleBirthInteger: "Multiple Birth Order",
  photo: "Photograph",
  contact: "Contact",
  communication: "Communication",
  generalPractitioner: "General Practitioner",
  managingOrganization: "Managing Organization",

  // Narrative
  "text.status": "Narrative Status",
  "text.div": "Narrative XHTML",

  // Common date/time fields
  effectiveDateTime: "Effective Date/Time",
  effectivePeriod: "Effective Period",
  issued: "Issued",
  recorded: "Recorded",
  authoredOn: "Authored On",

  // Notes
  "note.author": "Note Author",
  "note.time": "Note Time",
  "note.text": "Note Text",
  comment: "Comment",
};

/** Strip array indices and resource-type prefix from a JSON path so we can
 *  look up by property-name fragment. */
function propertyFragment(path: string): string {
  // "Patient.name[0].family" → "name.family"
  // "Bundle.entry[0].resource.identifier[0].value" → "identifier.value"
  // "Patient.address[0].postalCode" → "address.postalCode"
  const noIndices = path.replace(/\[\d+\]/g, "");
  const segments = noIndices.split(".");
  if (segments.length <= 1) return noIndices;
  // Drop resource-type / Bundle/entry/resource navigation prefix; keep the
  // last 2-3 meaningful segments for a label-friendly key.
  const relevant: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!;
    relevant.unshift(seg);
    // Stop at the first known property-label root candidate.
    if (relevant.length >= 2) break;
  }
  return relevant.join(".");
}

/**
 * Resolve a label for a FHIR JSON path. resourceType is currently informational
 * only — the curated map is shared across R4 and R5 — but signature reserved
 * for future per-version divergence.
 */
export function getLabel(
  path: string,
  _resourceType?: string,
  _version?: "R4" | "R5",
): string {
  // 1. Exact full-path match
  const exact = PROPERTY_LABELS[path];
  if (exact) return exact;

  // 2. Property-fragment match (last 2 segments, indices stripped)
  const frag2 = propertyFragment(path);
  const fragMatch = PROPERTY_LABELS[frag2];
  if (fragMatch) return fragMatch;

  // 3. Last-segment match
  const noIndices = path.replace(/\[\d+\]/g, "");
  const last = noIndices.split(".").pop()!;
  const lastMatch = PROPERTY_LABELS[last];
  if (lastMatch) return lastMatch;

  // 4. Fallback to path
  return path;
}

/** Detect FHIR version from a parsed JSON resource. R4 vs R5 distinction
 *  relies on `meta.profile` URLs when present; defaults to R4. */
export function detectVersion(
  parsed: unknown,
): "R4" | "R5" | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as { meta?: { profile?: ReadonlyArray<string> } };
  const profiles = obj.meta?.profile ?? [];
  for (const p of profiles) {
    if (p.includes("/StructureDefinition/") && p.includes("R5")) return "R5";
  }
  return "R4";
}
