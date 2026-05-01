// @paste7/core — PHI rule-pack engine.
//
// See docs/engine-contract.md for the full design.

export { createEngine } from "./engine.js";
export type { Engine } from "./engine.js";

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
