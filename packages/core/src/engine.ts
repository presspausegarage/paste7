// Engine factory and interface. See docs/engine-contract.md sections 2 and 10.

import { detectFormat as detectFormatImpl } from "./format-detect.js";
import { createRedactor } from "./redact.js";
import type {
  EngineConfig,
  Format,
  FormatDetection,
  RedactOptions,
  RedactResult,
  RulePack,
  Walker,
  WalkerResult,
} from "./types.js";

import { hl7v2Walker } from "./walkers/hl7v2.js";
import { fhirJsonWalker } from "./walkers/json.js";
import { xmlWalker } from "./walkers/xml.js";

export interface Engine {
  /** Detect format, parse, redact, return result. */
  redact(input: string, options?: RedactOptions): Promise<RedactResult>;

  /** Detect format only. Useful for the UI to show format-confidence before commit. */
  detectFormat(input: string): Promise<FormatDetection>;

  /** Drop all session state (binding map, identity pool position). */
  reset(): void;
}

export interface EngineConfigExtended extends EngineConfig {
  /** Per-format rule packs. Defaults to the empty pack (no rules fire) until
   *  step 5 of Phase 1 ships the bundled packs. */
  rulePacks?: Partial<Record<Format, RulePack>>;
}

const WALKERS: ReadonlyArray<Walker<unknown>> = [
  hl7v2Walker,
  fhirJsonWalker,
  xmlWalker,
] as Walker<unknown>[];

function pickWalker(format: Format): Walker<unknown> {
  for (const w of WALKERS) {
    const formats = Array.isArray(w.format) ? w.format : [w.format];
    if (formats.includes(format)) return w;
  }
  // Should be unreachable: every Format value is covered by a walker.
  throw new Error(`No walker registered for format: ${format}`);
}

function emptyRulePack(format: Format): RulePack {
  return { format, rules: [] };
}

/**
 * Create a new engine instance. Each instance owns one session's worth of state
 * (identity pool position, real-value -> fake-value bindings). Closing the
 * instance discards that state.
 *
 * The Tauri scratchpad UI creates a new engine per paste action; an MCP server
 * (Phase 7) creates one per stdio connection.
 */
export function createEngine(config?: EngineConfigExtended): Engine {
  const redactor = createRedactor({ pool: config?.pool });
  const rulePacks = config?.rulePacks ?? {};

  return {
    async redact(input, options): Promise<RedactResult> {
      let format: Format;
      let detectionConfidence: number;
      if (options?.format) {
        format = options.format;
        detectionConfidence = 1;
      } else {
        const detection = detectFormatImpl(input);
        if (detection.confidence < 0.5) {
          throw new Error(
            `Could not detect format with confidence >= 0.5 (best guess: ${detection.format} @ ${detection.confidence}). Pass options.format to override.`,
          );
        }
        format = detection.format;
        detectionConfidence = detection.confidence;
      }

      const walker = pickWalker(format);
      const { parsed, parseErrors } = walker.parse(input);
      const rulePack = rulePacks[format] ?? emptyRulePack(format);
      const result: WalkerResult = walker.redact(parsed, rulePack, redactor);

      return {
        format,
        detectionConfidence,
        redacted: result.redacted,
        tree: result.tree,
        findings: result.findings,
        parseErrors: [...parseErrors, ...result.parseErrors],
      };
    },
    async detectFormat(input): Promise<FormatDetection> {
      return detectFormatImpl(input);
    },
    reset(): void {
      // The redactor returned by createRedactor includes a reset() method
      // (extended Redactor); narrow via type assertion since the public Redactor
      // interface doesn't expose it.
      (redactor as unknown as { reset(): void }).reset();
    },
  };
}
