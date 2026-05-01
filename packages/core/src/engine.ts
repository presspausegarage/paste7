// Engine factory and interface. See docs/engine-contract.md sections 2 and 10.

import { detectFormat as detectFormatImpl } from "./format-detect.js";
import type {
  EngineConfig,
  FormatDetection,
  RedactOptions,
  RedactResult,
} from "./types.js";

export interface Engine {
  /** Detect format, parse, redact, return result. */
  redact(input: string, options?: RedactOptions): Promise<RedactResult>;

  /** Detect format only. Useful for the UI to show format-confidence before commit. */
  detectFormat(input: string): Promise<FormatDetection>;

  /** Drop all session state (binding map, identity pool position). */
  reset(): void;
}

const NOT_IMPLEMENTED =
  "Phase 1 step in progress: redact() ships in subsequent steps.";

/**
 * Create a new engine instance. Each instance owns one session's worth of state
 * (identity pool position, real-value -> fake-value bindings). Closing the
 * instance discards that state.
 *
 * The Tauri scratchpad UI creates a new engine per paste action; an MCP server
 * (Phase 7) creates one per stdio connection.
 */
export function createEngine(_config?: EngineConfig): Engine {
  return {
    async redact(_input, _options) {
      throw new Error(NOT_IMPLEMENTED);
    },
    async detectFormat(input) {
      return detectFormatImpl(input);
    },
    reset() {
      // No state to clear yet; subsequent steps will populate session bindings here.
    },
  };
}
