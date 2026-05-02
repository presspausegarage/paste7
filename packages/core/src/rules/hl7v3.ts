// HL7 v3 messaging rule pack.
//
// HL7 v3 messages share their RIM-derived patient/author/custodian path
// fragments with CDA — only the document/interaction root differs (e.g.
// MCCI_IN000002UV01, PRPA_IN201301UV02). Rules use trailing-fragment patterns
// (rooted via `\/X\/` rather than `^/Root/X/`), so the same rule fires
// regardless of the interaction wrapper.
//
// RIM Role/Entity split: in v3 messaging `<patient>` is the Role and
// `<patientPerson>` is the Person Entity that plays it. The Role carries
// `<id>`; the Entity carries `<name>`/`<birthTime>`/`<addr>`/`<telecom>`.
// Some simpler v3 dialects flatten this and put name/birthTime/addr/
// telecom directly under `<patient>`. The non-id patterns make
// `/patientPerson` optional so both structures redact.
//
// Coverage scope per the rescope decision: only paths shared with CDA. Full
// per-interaction message-type catalogs are deferred to user-driven demand.

import type { RulePack } from "../types.js";
import { SHARED_RIM_RULES } from "./cda-shared.js";

export const HL7V3_RULES: RulePack = {
  format: "hl7v3",
  rules: [
    ...SHARED_RIM_RULES,
    // v3-specific subject/registrationProcess paths (used in PRPA/PRPM patient
    // registry messages). These mirror recordTarget but with v3-flavored
    // wrappers. Same patient-data shape underneath.
    {
      pattern: /\/subject\b.*\/patient(?:\/patientPerson)?\/name\/(?:given|family|prefix|suffix)$/,
      category: "name",
      rule: "v3/subject.patient.name",
    },
    {
      pattern: /\/subject\b.*\/patient(?:\/patientPerson)?\/birthTime\/@value$/,
      category: "date",
      rule: "v3/subject.patient.birthTime",
    },
    {
      pattern: /\/subject\b.*\/patient(?:\/patientPerson)?\/id\/@extension$/,
      category: "id",
      rule: "v3/subject.patient.id",
    },
    {
      pattern: /\/subject\b.*\/patient(?:\/patientPerson)?\/addr\/(?:streetAddressLine|city|county|postalCode)$/,
      category: "address",
      rule: "v3/subject.patient.addr",
    },
    {
      pattern: /\/subject\b.*\/patient(?:\/patientPerson)?\/telecom\/@value$/,
      category: "phone",
      rule: "v3/subject.patient.telecom",
    },
  ],
};
