// CDA / HL7 v3 shared rules. Both formats are RIM-derived and share path
// fragments under recordTarget, author/assignedAuthor, custodian, participant,
// componentOf. The difference is the document root: ClinicalDocument for CDA,
// interaction-specific (e.g. MCCI_IN000002UV01) for v3 messaging. Patterns are
// rooted at the inner fragments via `\/X\/` so they fire under either root.

import type { Rule } from "../types.js";

export const SHARED_RIM_RULES: ReadonlyArray<Rule> = [
  // ---------------------------------------------------------------------
  // Patient (recordTarget/patientRole/patient)
  // ---------------------------------------------------------------------
  {
    pattern: /\/recordTarget\/patientRole\/id\/@extension$/,
    category: "id",
    rule: "rim/recordTarget.id",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/name\/given$/,
    category: "name",
    rule: "rim/patient.name.given",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/name\/family$/,
    category: "name",
    rule: "rim/patient.name.family",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/name\/prefix$/,
    category: "name",
    rule: "rim/patient.name.prefix",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/name\/suffix$/,
    category: "name",
    rule: "rim/patient.name.suffix",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/birthTime\/@value$/,
    category: "date",
    rule: "rim/patient.birthTime",
  },
  {
    pattern: /\/recordTarget\/patientRole\/patient\/deceasedTime\/@value$/,
    category: "date",
    rule: "rim/patient.deceasedTime",
  },
  {
    pattern: /\/recordTarget\/patientRole\/addr\/streetAddressLine$/,
    category: "address",
    rule: "rim/recordTarget.addr.line",
  },
  {
    pattern: /\/recordTarget\/patientRole\/addr\/city$/,
    category: "address",
    rule: "rim/recordTarget.addr.city",
  },
  {
    pattern: /\/recordTarget\/patientRole\/addr\/county$/,
    category: "address",
    rule: "rim/recordTarget.addr.county",
  },
  {
    pattern: /\/recordTarget\/patientRole\/addr\/postalCode$/,
    category: "address",
    rule: "rim/recordTarget.addr.postalCode",
  },
  {
    pattern: /\/recordTarget\/patientRole\/telecom\/@value$/,
    category: "phone",
    rule: "rim/recordTarget.telecom",
  },
  // Mother's name nested inside patient
  {
    pattern:
      /\/recordTarget\/patientRole\/patient\/(?:guardian|birthplace|languageCommunication)\b.*\/name\/(?:given|family)$/,
    category: "name",
    rule: "rim/patient.guardian.name",
  },

  // ---------------------------------------------------------------------
  // Author / assignedAuthor (provider PHI by association with the record)
  // ---------------------------------------------------------------------
  {
    pattern: /\/author\/assignedAuthor\/id\/@extension$/,
    category: "id",
    rule: "rim/author.id",
  },
  {
    pattern: /\/author\/assignedAuthor\/assignedPerson\/name\/(?:given|family|prefix|suffix)$/,
    category: "name",
    rule: "rim/author.name",
  },
  {
    pattern: /\/author\/assignedAuthor\/addr\/(?:streetAddressLine|city|county|postalCode)$/,
    category: "address",
    rule: "rim/author.addr",
  },
  {
    pattern: /\/author\/assignedAuthor\/telecom\/@value$/,
    category: "phone",
    rule: "rim/author.telecom",
  },

  // ---------------------------------------------------------------------
  // Custodian
  // ---------------------------------------------------------------------
  {
    pattern: /\/custodian\/assignedCustodian\/representedCustodianOrganization\/id\/@extension$/,
    category: "id",
    rule: "rim/custodian.id",
  },
  {
    pattern: /\/custodian\/assignedCustodian\/representedCustodianOrganization\/addr\/(?:streetAddressLine|city|county|postalCode)$/,
    category: "address",
    rule: "rim/custodian.addr",
  },
  {
    pattern: /\/custodian\/assignedCustodian\/representedCustodianOrganization\/telecom\/@value$/,
    category: "phone",
    rule: "rim/custodian.telecom",
  },

  // ---------------------------------------------------------------------
  // Participant (e.g. emergency contact, support, holder of health insurance)
  // ---------------------------------------------------------------------
  {
    pattern: /\/participant\b.*\/id\/@extension$/,
    category: "id",
    rule: "rim/participant.id",
  },
  {
    pattern: /\/participant\b.*\/name\/(?:given|family|prefix|suffix)$/,
    category: "name",
    rule: "rim/participant.name",
  },
  {
    pattern: /\/participant\b.*\/addr\/(?:streetAddressLine|city|county|postalCode)$/,
    category: "address",
    rule: "rim/participant.addr",
  },
  {
    pattern: /\/participant\b.*\/telecom\/@value$/,
    category: "phone",
    rule: "rim/participant.telecom",
  },

  // ---------------------------------------------------------------------
  // componentOf — encounter context
  // ---------------------------------------------------------------------
  {
    pattern:
      /\/componentOf\b.*\/effectiveTime\/(?:low|high|center)\/@value$/,
    category: "date",
    rule: "rim/encounter.effectiveTime",
  },
  {
    pattern: /\/componentOf\b.*\/id\/@extension$/,
    category: "id",
    rule: "rim/encounter.id",
  },

  // ---------------------------------------------------------------------
  // Free text — narrative <text> elements at section level (CDA primarily)
  // ---------------------------------------------------------------------
  {
    pattern: /\/section\/text$/,
    category: "free-text",
    rule: "rim/section.text",
    strategy: "flag-only",
  },
];
