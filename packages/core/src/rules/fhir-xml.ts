// FHIR XML rule pack — same logical coverage as fhir-json.ts but the path
// syntax is XPath-style (per engine-contract section 5).
//
// FHIR XML uses attribute-valued leaves: <given value="John"/> rather than
// <given>John</given>. The walker emits the leaf path with the @value
// attribute as the redaction target.

import type { RulePack } from "../types.js";

export const FHIR_XML_RULES: RulePack = {
  format: "fhir-xml",
  rules: [
    // ---------------------------------------------------------------------
    // Names — HumanName.family/given/prefix/suffix
    // ---------------------------------------------------------------------
    {
      pattern: /\/name\/family\/@value$/,
      category: "name",
      rule: "fhir/name.family",
    },
    {
      pattern: /\/name\/given\/@value$/,
      category: "name",
      rule: "fhir/name.given",
    },
    {
      pattern: /\/name\/text\/@value$/,
      category: "name",
      rule: "fhir/name.text",
    },
    {
      pattern: /\/name\/prefix\/@value$/,
      category: "name",
      rule: "fhir/name.prefix",
    },
    {
      pattern: /\/name\/suffix\/@value$/,
      category: "name",
      rule: "fhir/name.suffix",
    },

    // ---------------------------------------------------------------------
    // Identifiers
    // ---------------------------------------------------------------------
    {
      pattern: /\/identifier\/value\/@value$/,
      category: "id",
      rule: "fhir/identifier.value",
    },

    // ---------------------------------------------------------------------
    // Telecom
    // ---------------------------------------------------------------------
    {
      pattern: /\/telecom\/value\/@value$/,
      category: "phone",
      rule: "fhir/telecom.value",
    },

    // ---------------------------------------------------------------------
    // Address
    // ---------------------------------------------------------------------
    {
      pattern: /\/address\/line\/@value$/,
      category: "address",
      rule: "fhir/address.line",
    },
    {
      pattern: /\/address\/city\/@value$/,
      category: "address",
      rule: "fhir/address.city",
    },
    {
      pattern: /\/address\/district\/@value$/,
      category: "address",
      rule: "fhir/address.district",
    },
    {
      pattern: /\/address\/postalCode\/@value$/,
      category: "address",
      rule: "fhir/address.postalCode",
    },
    {
      pattern: /\/address\/text\/@value$/,
      category: "address",
      rule: "fhir/address.text",
    },

    // ---------------------------------------------------------------------
    // Dates
    // ---------------------------------------------------------------------
    {
      pattern: /\/birthDate\/@value$/,
      category: "date",
      rule: "fhir/birthDate",
    },
    {
      pattern: /\/deceasedDateTime\/@value$/,
      category: "date",
      rule: "fhir/deceasedDateTime",
    },

    // ---------------------------------------------------------------------
    // Photo
    // ---------------------------------------------------------------------
    {
      pattern: /\/photo\/data\/@value$/,
      category: "photo",
      rule: "fhir/photo.data",
      strategy: "scrub",
    },

    // ---------------------------------------------------------------------
    // Resource-level id (where it's commonly the MRN)
    // ---------------------------------------------------------------------
    {
      pattern:
        /^(?:\/Bundle\/entry\/resource)?\/(?:Patient|Practitioner|RelatedPerson|Person|Coverage)\/id\/@value$/,
      category: "id",
      rule: "fhir/resource.id",
    },

    // ---------------------------------------------------------------------
    // Free text
    // ---------------------------------------------------------------------
    {
      pattern: /\/text\/div$/,
      category: "free-text",
      rule: "fhir/text.div",
      strategy: "flag-only",
    },
    {
      pattern: /\/comment\/@value$/,
      category: "free-text",
      rule: "fhir/comment",
      strategy: "flag-only",
    },
    {
      pattern: /\/note\/text\/@value$/,
      category: "free-text",
      rule: "fhir/note.text",
      strategy: "flag-only",
    },
  ],
};
