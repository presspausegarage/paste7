// CDA / HL7 v3 RIM label resolver. Hand-curated against the RIM-derived
// element names that appear in the SHARED_RIM_RULES rule pack plus common
// document-structure navigation.
//
// CDA paths are XPath-style absolute (e.g.
// /ClinicalDocument/recordTarget/patientRole/patient/name/given). The walker
// emits localName-only segments (no namespace prefix), so the resolver can
// look up by the trailing element name or a multi-element trailing fragment.

const FRAGMENT_LABELS: Readonly<Record<string, string>> = {
  // Document roots
  ClinicalDocument: "Clinical Document",

  // Header sections
  recordTarget: "Record Target (Patient)",
  patientRole: "Patient Role",
  patient: "Patient",
  author: "Author",
  assignedAuthor: "Assigned Author",
  assignedPerson: "Assigned Person",
  custodian: "Custodian",
  assignedCustodian: "Assigned Custodian",
  representedCustodianOrganization: "Custodian Organization",
  participant: "Participant",
  associatedEntity: "Associated Entity",
  componentOf: "Encompassing Encounter",
  encompassingEncounter: "Encounter",

  // Identifiers
  id: "Identifier",
  templateId: "Template ID",
  code: "Code",

  // Names
  name: "Name",
  given: "Given Name",
  family: "Family Name",
  prefix: "Name Prefix",
  suffix: "Name Suffix",

  // Address
  addr: "Address",
  streetAddressLine: "Street Address Line",
  city: "City",
  state: "State",
  postalCode: "Postal Code",
  county: "County",
  country: "Country",

  // Telecom
  telecom: "Contact Point",

  // Demographics
  administrativeGenderCode: "Gender",
  birthTime: "Date of Birth",
  deceasedTime: "Date of Death",
  maritalStatusCode: "Marital Status",
  raceCode: "Race",
  ethnicGroupCode: "Ethnicity",
  languageCommunication: "Language",

  // Encounter
  effectiveTime: "Effective Time",
  low: "Range Low",
  high: "Range High",
  center: "Range Center",

  // Body / sections
  component: "Component",
  structuredBody: "Structured Body",
  section: "Section",
  title: "Section Title",
  text: "Narrative Text",
  entry: "Section Entry",
  nonXMLBody: "Non-XML Body",

  // HL7 v3 messaging extras
  controlActProcess: "Control Act Process",
  subject: "Subject",
  registrationProcess: "Registration Process",

  // Common attributes — the walker emits these as @attrName
  "@extension": "Identifier Extension",
  "@root": "Identifier Root",
  "@value": "Value",
  "@code": "Code",
  "@displayName": "Display Name",
  "@codeSystem": "Code System",
  "@codeSystemName": "Code System Name",
};

function lastSegment(path: string): string {
  // Strip query/predicate, keep last /segment or /@attr
  const segments = path.split("/").filter((s) => s.length > 0);
  return segments[segments.length - 1] ?? path;
}

/**
 * Resolve a label for a CDA / HL7 v3 path. Looks up by trailing element or
 * attribute name; falls back to the input path.
 */
export function getLabel(path: string): string {
  const last = lastSegment(path);
  return FRAGMENT_LABELS[last] ?? path;
}
