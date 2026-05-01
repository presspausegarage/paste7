// HL7 v2 rule pack — Safe Harbor coverage across patient/family/insurance segments.
//
// Coverage: PID, NK1, GT1, IN1, IN2 patient-context segments + OBX/NTE/DG1/PR1
// free-text scanning. Note: facility/sender fields (MSH-3,4,5,6) are NOT
// redacted by default — they are routing metadata, not Safe Harbor patient
// identifiers, and redacting them breaks downstream parsers that route on
// them. A user who needs facility redaction can compose an extra rule pack.

import type { RulePack } from "../types.js";

export const HL7V2_RULES: RulePack = {
  format: "hl7v2",
  rules: [
    // ---------------------------------------------------------------------
    // PID — Patient Identification
    // ---------------------------------------------------------------------
    { path: "PID-2", category: "id", rule: "hl7v2/PID-2" },
    { path: "PID-3", category: "id", rule: "hl7v2/PID-3" },
    { path: "PID-4", category: "id", rule: "hl7v2/PID-4" },
    { path: "PID-5", category: "name", rule: "hl7v2/PID-5" },
    { path: "PID-6", category: "name", rule: "hl7v2/PID-6" },
    { path: "PID-7", category: "date", rule: "hl7v2/PID-7" },
    { path: "PID-9", category: "name", rule: "hl7v2/PID-9" },
    { path: "PID-11", category: "address", rule: "hl7v2/PID-11" },
    { path: "PID-12", category: "address", rule: "hl7v2/PID-12" },
    { path: "PID-13", category: "phone", rule: "hl7v2/PID-13" },
    { path: "PID-14", category: "phone", rule: "hl7v2/PID-14" },
    { path: "PID-18", category: "id", rule: "hl7v2/PID-18" },
    { path: "PID-19", category: "id", rule: "hl7v2/PID-19" }, // SSN (deprecated but still seen)
    { path: "PID-20", category: "id", rule: "hl7v2/PID-20" }, // Driver's license
    { path: "PID-21", category: "id", rule: "hl7v2/PID-21" }, // Mother's identifier
    { path: "PID-29", category: "date", rule: "hl7v2/PID-29" }, // Date of death

    // ---------------------------------------------------------------------
    // NK1 — Next of Kin
    // ---------------------------------------------------------------------
    { path: "NK1-2", category: "name", rule: "hl7v2/NK1-2" },
    { path: "NK1-4", category: "address", rule: "hl7v2/NK1-4" },
    { path: "NK1-5", category: "phone", rule: "hl7v2/NK1-5" },
    { path: "NK1-6", category: "phone", rule: "hl7v2/NK1-6" },
    { path: "NK1-12", category: "id", rule: "hl7v2/NK1-12" },
    { path: "NK1-30", category: "name", rule: "hl7v2/NK1-30" },
    { path: "NK1-32", category: "address", rule: "hl7v2/NK1-32" },
    { path: "NK1-33", category: "phone", rule: "hl7v2/NK1-33" },

    // ---------------------------------------------------------------------
    // GT1 — Guarantor
    // ---------------------------------------------------------------------
    { path: "GT1-2", category: "id", rule: "hl7v2/GT1-2" },
    { path: "GT1-3", category: "name", rule: "hl7v2/GT1-3" },
    { path: "GT1-4", category: "name", rule: "hl7v2/GT1-4" },
    { path: "GT1-5", category: "address", rule: "hl7v2/GT1-5" },
    { path: "GT1-6", category: "phone", rule: "hl7v2/GT1-6" },
    { path: "GT1-7", category: "phone", rule: "hl7v2/GT1-7" },
    { path: "GT1-8", category: "date", rule: "hl7v2/GT1-8" },
    { path: "GT1-12", category: "id", rule: "hl7v2/GT1-12" },
    { path: "GT1-19", category: "id", rule: "hl7v2/GT1-19" },
    { path: "GT1-37", category: "id", rule: "hl7v2/GT1-37" }, // SSN

    // ---------------------------------------------------------------------
    // IN1 — Insurance
    // ---------------------------------------------------------------------
    { path: "IN1-2", category: "id", rule: "hl7v2/IN1-2" },
    { path: "IN1-3", category: "id", rule: "hl7v2/IN1-3" },
    { path: "IN1-16", category: "name", rule: "hl7v2/IN1-16" }, // Insured's name
    { path: "IN1-18", category: "date", rule: "hl7v2/IN1-18" }, // Insured's DOB
    { path: "IN1-19", category: "address", rule: "hl7v2/IN1-19" },
    { path: "IN1-36", category: "id", rule: "hl7v2/IN1-36" }, // Policy number
    { path: "IN1-49", category: "id", rule: "hl7v2/IN1-49" }, // Insured's ID

    // ---------------------------------------------------------------------
    // IN2 — Insurance Add'l Info
    // ---------------------------------------------------------------------
    { path: "IN2-1", category: "id", rule: "hl7v2/IN2-1" },
    { path: "IN2-2", category: "id", rule: "hl7v2/IN2-2" }, // SSN
    { path: "IN2-22", category: "name", rule: "hl7v2/IN2-22" },
    { path: "IN2-25", category: "date", rule: "hl7v2/IN2-25" },
    { path: "IN2-61", category: "phone", rule: "hl7v2/IN2-61" },
    { path: "IN2-63", category: "name", rule: "hl7v2/IN2-63" }, // Mother's maiden name
    { path: "IN2-64", category: "date", rule: "hl7v2/IN2-64" },
    { path: "IN2-69", category: "phone", rule: "hl7v2/IN2-69" },

    // ---------------------------------------------------------------------
    // Free-text fields — narrative scanning, value preserved (flag-only)
    // ---------------------------------------------------------------------
    {
      pattern: /^OBX-5/,
      category: "free-text",
      rule: "hl7v2/OBX-5",
      strategy: "flag-only",
    },
    {
      pattern: /^NTE-3/,
      category: "free-text",
      rule: "hl7v2/NTE-3",
      strategy: "flag-only",
    },
    {
      pattern: /^DG1-4/,
      category: "free-text",
      rule: "hl7v2/DG1-4",
      strategy: "flag-only",
    },
    {
      pattern: /^PR1-4/,
      category: "free-text",
      rule: "hl7v2/PR1-4",
      strategy: "flag-only",
    },
    {
      pattern: /^DG1-16/,
      category: "free-text",
      rule: "hl7v2/DG1-16",
      strategy: "flag-only",
    },
  ],
};
