// FHIR JSON rule pack — Safe Harbor coverage by property name across all
// resources that carry the property.
//
// FHIR's resource model spreads PHI fields across many resource types
// (Patient, Practitioner, RelatedPerson, Person, Coverage, Insurance, etc.)
// but the property names are uniform: name.family, identifier.value,
// telecom.value, address.line, birthDate. So a small regex set covers
// every resource the message contains, including nested resources inside
// Bundle.entry[].resource.
//
// Path syntax (per engine-contract section 5):
//   Patient.name[0].family
//   Bundle.entry[2].resource.identifier[0].value
// The patterns below match the trailing path fragment regardless of the
// resource-type prefix.

import type { RulePack } from "../types.js";

export const FHIR_JSON_RULES: RulePack = {
  format: "fhir-json",
  rules: [
    // ---------------------------------------------------------------------
    // Names — HumanName.family/given/prefix/suffix on Patient, Practitioner,
    // RelatedPerson, Person, Patient.contact, etc.
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)name\[\d+\]\.family$/,
      category: "name",
      rule: "fhir/name.family",
    },
    {
      pattern: /(?:^|\.)name\[\d+\]\.given\[\d+\]$/,
      category: "name",
      rule: "fhir/name.given",
    },
    {
      pattern: /(?:^|\.)name\[\d+\]\.text$/,
      category: "name",
      rule: "fhir/name.text",
    },
    {
      pattern: /(?:^|\.)name\[\d+\]\.prefix\[\d+\]$/,
      category: "name",
      rule: "fhir/name.prefix",
    },
    {
      pattern: /(?:^|\.)name\[\d+\]\.suffix\[\d+\]$/,
      category: "name",
      rule: "fhir/name.suffix",
    },

    // ---------------------------------------------------------------------
    // Identifiers — Identifier.value on every resource that has identifier[]
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)identifier\[\d+\]\.value$/,
      category: "id",
      rule: "fhir/identifier.value",
    },
    // Resource-level id often contains the MRN in real-world deployments.
    // Match top-level PHI-bearing resources directly and Bundle-wrapped
    // resources by structural position (the JSON walker doesn't carry
    // resource-type into the path of a nested resource). Intentionally
    // skip data-type element ids (HumanName.id, Identifier.id, etc.) which
    // are internal element references, not PHI.
    {
      pattern:
        /^(?:(?:Patient|Practitioner|RelatedPerson|Person|Coverage)\.id|Bundle\.entry\[\d+\]\.resource\.id)$/,
      category: "id",
      rule: "fhir/resource.id",
    },

    // ---------------------------------------------------------------------
    // Telecom — phone, email, fax in ContactPoint.value
    // The category "phone" routes to the redactor's phone shape; the
    // redactor's phone generator preserves dashed/dotted/parens shape, but
    // emails go through unchanged. Free-text scanner picks up emails.
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)telecom\[\d+\]\.value$/,
      category: "phone",
      rule: "fhir/telecom.value",
    },

    // ---------------------------------------------------------------------
    // Address — line, city, postalCode, district. State is typically not
    // PHI for HIPAA (Safe Harbor allows state granularity).
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)address\[\d+\]\.line\[\d+\]$/,
      category: "address",
      rule: "fhir/address.line",
    },
    {
      pattern: /(?:^|\.)address\[\d+\]\.city$/,
      category: "address",
      rule: "fhir/address.city",
    },
    {
      pattern: /(?:^|\.)address\[\d+\]\.district$/,
      category: "address",
      rule: "fhir/address.district",
    },
    {
      pattern: /(?:^|\.)address\[\d+\]\.postalCode$/,
      category: "address",
      rule: "fhir/address.postalCode",
    },
    {
      pattern: /(?:^|\.)address\[\d+\]\.text$/,
      category: "address",
      rule: "fhir/address.text",
    },

    // ---------------------------------------------------------------------
    // Dates — birthDate, deceasedDateTime, effective dates that contain
    // patient-specific DOBs.
    // ---------------------------------------------------------------------
    { pattern: /(?:^|\.)birthDate$/, category: "date", rule: "fhir/birthDate" },
    {
      pattern: /(?:^|\.)deceasedDateTime$/,
      category: "date",
      rule: "fhir/deceasedDateTime",
    },

    // ---------------------------------------------------------------------
    // Photo — Patient.photo[].data is base64 binary
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)photo\[\d+\]\.data$/,
      category: "photo",
      rule: "fhir/photo.data",
      strategy: "scrub",
    },

    // ---------------------------------------------------------------------
    // Free text — narrative .text.div, comments
    // ---------------------------------------------------------------------
    {
      pattern: /(?:^|\.)text\.div$/,
      category: "free-text",
      rule: "fhir/text.div",
      strategy: "flag-only",
    },
    {
      pattern: /(?:^|\.)comment$/,
      category: "free-text",
      rule: "fhir/comment",
      strategy: "flag-only",
    },
    {
      pattern: /(?:^|\.)note\[\d+\]\.text$/,
      category: "free-text",
      rule: "fhir/note.text",
      strategy: "flag-only",
    },
  ],
};
