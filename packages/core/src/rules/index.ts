// Bundled rule packs. The engine consumes these by default; callers can
// override per-format via EngineConfigExtended.rulePacks.

import type { Format, RulePack } from "../types.js";
import { HL7V2_RULES } from "./hl7v2.js";
import { FHIR_JSON_RULES } from "./fhir-json.js";
import { FHIR_XML_RULES } from "./fhir-xml.js";
import { CDA_RULES } from "./cda.js";
import { HL7V3_RULES } from "./hl7v3.js";

export { HL7V2_RULES } from "./hl7v2.js";
export { FHIR_JSON_RULES } from "./fhir-json.js";
export { FHIR_XML_RULES } from "./fhir-xml.js";
export { CDA_RULES } from "./cda.js";
export { HL7V3_RULES } from "./hl7v3.js";
export { SHARED_RIM_RULES } from "./cda-shared.js";

export const DEFAULT_RULE_PACKS: Readonly<Record<Format, RulePack>> = {
  hl7v2: HL7V2_RULES,
  hl7v3: HL7V3_RULES,
  cda: CDA_RULES,
  "fhir-json": FHIR_JSON_RULES,
  "fhir-xml": FHIR_XML_RULES,
};
