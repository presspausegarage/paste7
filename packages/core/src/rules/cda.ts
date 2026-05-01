// CDA (Clinical Document Architecture R2) rule pack.
//
// Most coverage comes from SHARED_RIM_RULES — patient/author/custodian/
// participant/componentOf paths under the ClinicalDocument root. CDA-specific
// additions: top-level document-level free-text inside the unstructured body.

import type { RulePack } from "../types.js";
import { SHARED_RIM_RULES } from "./cda-shared.js";

export const CDA_RULES: RulePack = {
  format: "cda",
  rules: [
    ...SHARED_RIM_RULES,
    // Document-level <text> outside section structure (narrative fallback).
    {
      pattern: /^\/ClinicalDocument\/text$/,
      category: "free-text",
      rule: "cda/document.text",
      strategy: "flag-only",
    },
    // nonXMLBody base64 payload: the entire body is opaque content; scrub it
    // because we can't selectively redact opaque binary.
    {
      pattern: /^\/ClinicalDocument\/component\/nonXMLBody\/text$/,
      category: "free-text",
      rule: "cda/nonXMLBody",
      strategy: "scrub",
    },
  ],
};
