// @paste7/core — PHI rule-pack engine.
//
// See docs/engine-contract.md for the full design.

export { createEngine } from "./engine.js";
export type { Engine, EngineConfigExtended } from "./engine.js";

export { createRedactor } from "./redact.js";
export type { RedactorOptions } from "./redact.js";

export { DEFAULT_POOL, NORSE_NAMES, NORSE_STREETS, NORSE_CITIES } from "./identities.js";

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
