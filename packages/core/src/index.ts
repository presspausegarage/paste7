// @paste7/core — PHI rule-pack engine.
//
// See docs/engine-contract.md for the full design.

export { createEngine } from "./engine.js";
export type { Engine, EngineConfigExtended } from "./engine.js";

export { createRedactor } from "./redact.js";
export type { RedactorOptions } from "./redact.js";

export { DEFAULT_POOL, NORSE_NAMES, NORSE_STREETS, NORSE_CITIES } from "./identities.js";

export {
  DEFAULT_RULE_PACKS,
  HL7V2_RULES,
  FHIR_JSON_RULES,
  FHIR_XML_RULES,
  CDA_RULES,
  HL7V3_RULES,
  SHARED_RIM_RULES,
} from "./rules/index.js";

export type {
  Format,
  FormatDetection,
  PHICategory,
  RedactStrategy,
  Finding,
  ParseError,
  TokenKind,
  TokenNode,
  TokenTree,
  RedactResult,
  RedactOptions,
  EngineConfig,
  NamePair,
  IdentityPool,
  Rule,
  RulePack,
  Walker,
  WalkerResult,
  RedactRequest,
  RedactResponse,
  FreeTextScanRequest,
  Redactor,
} from "./types.js";

export { DEFAULT_STRATEGIES } from "./types.js";

// Persistence-boundary guard (Phase 4 deliverable) -- see module doc.
export { SecretValue, secret } from "./secret.js";
export type { Persistable } from "./secret.js";

// DICOM SR header redaction surface (Phase 3).
export { createDicomRedactor } from "./dicom/redactor.js";
export {
  isSrSopClass,
  getSrSopClassName,
  KNOWN_SR_SOP_CLASSES,
  SR_SOP_CLASS_PREFIX,
} from "./dicom/sop-classes.js";
export {
  DEFAULT_DICOM_SR_RULES,
  DEFAULT_DICOM_SR_RULE_PACK,
} from "./dicom/rules.js";
export type {
  DicomFinding,
  DicomRedactor,
  DicomRedactorConfig,
  DicomRedactResult,
  DicomRetainProfile,
  DicomRule,
  DicomRulePack,
} from "./dicom/types.js";
