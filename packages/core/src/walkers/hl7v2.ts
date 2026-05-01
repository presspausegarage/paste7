// HL7 v2 walker. See docs/engine-contract.md sections 5 (walker contract) and 6 (rule packs).
//
// HL7 v2 messages are delimited text:
//   segments  separated by \r (canonical) or \n
//   fields    separated by  |     (MSH-1 = the literal field separator)
//   reps      separated by  ~
//   comps     separated by  ^
//   subcomps  separated by  &
//   escape    \              (MSH-2 = "^~\&" by default)
//
// Path syntax for rule packs: SEG-N[.M[.K]] (1-indexed). Repetitions and segment
// occurrences are not part of the path: a rule that matches PID-5 fires for every
// PID segment and every repetition of field 5 within it.

import type {
  Finding,
  ParseError,
  Redactor,
  Rule,
  RulePack,
  TokenNode,
  TokenTree,
  Walker,
  WalkerResult,
} from "../types.js";
import { DEFAULT_STRATEGIES } from "../types.js";
import { detectVersion, getLabel } from "../labels/hl7v2.js";

// -----------------------------------------------------------------------------
// Internal AST
// -----------------------------------------------------------------------------

interface Separators {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subcomponent: string;
}

const DEFAULT_SEPARATORS: Separators = {
  field: "|",
  component: "^",
  repetition: "~",
  escape: "\\",
  subcomponent: "&",
};

interface ParsedMessage {
  segments: ParsedSegment[];
  separators: Separators;
  /** Line ending observed in the input ("\r\n", "\n", or "\r"). Preserved on serialize. */
  lineEnding: string;
  /** Message version read from MSH-12, used by the label resolver. Undefined when
   *  no MSH segment is present (partial paste) — resolver falls back to v2.5. */
  version: string | undefined;
}

interface ParsedSegment {
  name: string;
  /**
   * Fields indexed by HL7 field number (1-based). Index 0 is unused for normal
   * segments. For MSH, MSH-1 is synthetic (the field separator literal) and lives
   * at index 1, MSH-2 at index 2, etc. — the walker treats MSH the same as any
   * other segment after parsing.
   */
  fields: ParsedField[];
}

interface ParsedField {
  reps: ParsedRep[];
}

interface ParsedRep {
  components: ParsedComponent[];
}

interface ParsedComponent {
  subcomponents: string[];
}

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

function detectLineEnding(input: string): string {
  if (input.includes("\r\n")) return "\r\n";
  if (input.includes("\r")) return "\r";
  return "\n";
}

function splitLines(input: string): string[] {
  return input.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
}

function parseSeparators(mshLine: string): Separators {
  // mshLine looks like: MSH|^~\&|...
  // Field separator is the 4th char; encoding chars are positions 4..7.
  if (mshLine.length < 8 || mshLine.slice(0, 3) !== "MSH") {
    return DEFAULT_SEPARATORS;
  }
  const field = mshLine[3] ?? "|";
  const component = mshLine[4] ?? "^";
  const repetition = mshLine[5] ?? "~";
  const escape = mshLine[6] ?? "\\";
  const subcomponent = mshLine[7] ?? "&";
  return { field, component, repetition, escape, subcomponent };
}

function parseField(raw: string, sep: Separators): ParsedField {
  if (raw === "") {
    return { reps: [{ components: [{ subcomponents: [""] }] }] };
  }
  const repStrings = raw.split(sep.repetition);
  const reps: ParsedRep[] = repStrings.map((repRaw) => ({
    components: repRaw.split(sep.component).map((compRaw) => ({
      subcomponents: compRaw.split(sep.subcomponent),
    })),
  }));
  return { reps };
}

function parseSegmentLine(
  line: string,
  sep: Separators,
  isMSH: boolean,
): ParsedSegment {
  const parts = line.split(sep.field);
  const name = parts[0] ?? "";
  const fields: ParsedField[] = [];
  // Index 0 reserved (segment name itself); fields start at 1.
  fields.push({ reps: [{ components: [{ subcomponents: [name] }] }] });

  if (isMSH) {
    // MSH-1 is the field separator itself; reconstruct synthetically.
    fields.push({
      reps: [{ components: [{ subcomponents: [sep.field] }] }],
    });
    // Subsequent parts (encoding chars onward) are MSH-2, MSH-3, ...
    for (let i = 1; i < parts.length; i++) {
      fields.push(parseField(parts[i] ?? "", sep));
    }
  } else {
    for (let i = 1; i < parts.length; i++) {
      fields.push(parseField(parts[i] ?? "", sep));
    }
  }
  return { name, fields };
}

export function parse(input: string): {
  parsed: ParsedMessage;
  parseErrors: ReadonlyArray<ParseError>;
} {
  const parseErrors: ParseError[] = [];
  const lineEnding = detectLineEnding(input);
  const lines = splitLines(input);

  let separators = DEFAULT_SEPARATORS;
  const firstMsh = lines.find((l) => l.startsWith("MSH"));
  if (firstMsh) {
    separators = parseSeparators(firstMsh);
  } else if (lines.length > 0) {
    parseErrors.push({
      path: "",
      severity: "warning",
      message:
        "No MSH segment found; using default separators |^~\\&. Partial-paste mode.",
    });
  }

  const segments: ParsedSegment[] = [];
  for (const line of lines) {
    if (line.length < 3) {
      parseErrors.push({
        path: "",
        severity: "warning",
        message: `Skipped malformed line (under 3 chars): ${JSON.stringify(line)}`,
      });
      continue;
    }
    // Segment name: first 3 chars, then field separator. Tolerate non-conforming
    // lines by recording an error and skipping.
    if (line[3] !== separators.field) {
      parseErrors.push({
        path: line.slice(0, 3),
        severity: "warning",
        message: `Segment line does not start with 3-char name + field separator: ${JSON.stringify(
          line.slice(0, 8),
        )}`,
      });
      continue;
    }
    const isMSH = line.startsWith("MSH");
    segments.push(parseSegmentLine(line, separators, isMSH));
  }

  const version = detectVersion(firstMsh);

  return {
    parsed: { segments, separators, lineEnding, version },
    parseErrors,
  };
}

// -----------------------------------------------------------------------------
// Serialize
// -----------------------------------------------------------------------------

function serializeComponent(comp: ParsedComponent, sep: Separators): string {
  return comp.subcomponents.join(sep.subcomponent);
}

function serializeRep(rep: ParsedRep, sep: Separators): string {
  return rep.components.map((c) => serializeComponent(c, sep)).join(sep.component);
}

function serializeField(field: ParsedField, sep: Separators): string {
  return field.reps.map((r) => serializeRep(r, sep)).join(sep.repetition);
}

function serializeSegment(seg: ParsedSegment, sep: Separators): string {
  // MSH special case: MSH-1 (the field separator literal) is implicit between
  // the segment name and MSH-2, not a distinct token. So skip index 1 on output.
  const isMSH = seg.name === "MSH";
  const parts: string[] = [seg.name];
  const start = isMSH ? 2 : 1;
  for (let i = start; i < seg.fields.length; i++) {
    const field = seg.fields[i];
    if (!field) {
      parts.push("");
      continue;
    }
    parts.push(serializeField(field, sep));
  }
  return parts.join(sep.field);
}

function serializeMessage(msg: ParsedMessage): string {
  return msg.segments
    .map((s) => serializeSegment(s, msg.separators))
    .join(msg.lineEnding);
}

// -----------------------------------------------------------------------------
// Rule matching
// -----------------------------------------------------------------------------

function matchRule(ruleset: RulePack, path: string): Rule | undefined {
  for (const rule of ruleset.rules) {
    if (rule.path !== undefined) {
      if (rule.path === path) return rule;
    } else if (rule.pattern !== undefined) {
      if (rule.pattern.test(path)) return rule;
    }
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Redaction walk
// -----------------------------------------------------------------------------

interface WalkContext {
  ruleset: RulePack;
  redactor: Redactor;
  separators: Separators;
  findings: Finding[];
  version: string | undefined;
}

/** Apply a redaction at the field level: replaces every repetition in place. */
function applyFieldRedaction(
  field: ParsedField,
  fieldPath: string,
  rule: Rule,
  ctx: WalkContext,
): void {
  const strategy = rule.strategy ?? DEFAULT_STRATEGIES[rule.category];

  // Free-text scanning runs over the whole serialized field, regardless of
  // whether the field-level strategy substitutes.
  if (rule.category === "free-text") {
    const serialized = serializeField(field, ctx.separators);
    const scanFindings = ctx.redactor.scanFreeText({
      value: serialized,
      path: fieldPath,
      rule: rule.rule,
    });
    ctx.findings.push(...scanFindings);
  }

  // Apply the field-level strategy on each repetition independently so that
  // a 2-rep PID-13 produces 2 substitutions. Cross-message consistency is the
  // redactor's job via its binding map.
  for (let r = 0; r < field.reps.length; r++) {
    const repText = serializeRep(field.reps[r]!, ctx.separators);
    const response = ctx.redactor.apply({
      category: rule.category,
      value: repText,
      strategy,
      path: fieldPath,
      rule: rule.rule,
    });
    ctx.findings.push(response.finding);

    if (response.value === null) {
      field.reps[r] = { components: [{ subcomponents: [""] }] };
    } else {
      // Re-parse the replacement back into structured form so further serialization
      // round-trips cleanly: substitute strategies may emit "FAMILY^GIVEN" which
      // must split on the component separator.
      field.reps[r] = parseRepFromString(response.value, ctx.separators);
    }
  }
}

function parseRepFromString(raw: string, sep: Separators): ParsedRep {
  return {
    components: raw.split(sep.component).map((compRaw) => ({
      subcomponents: compRaw.split(sep.subcomponent),
    })),
  };
}

function buildSubcomponentNodes(
  comp: ParsedComponent,
  basePath: string,
  version: string | undefined,
): TokenNode[] {
  if (comp.subcomponents.length <= 1) return [];
  return comp.subcomponents.map((sc, idx) => {
    const path = `${basePath}.${idx + 1}`;
    return {
      path,
      label: getLabel(path, version),
      kind: "subcomponent" as const,
      value: sc,
    };
  });
}

function buildComponentNodes(
  rep: ParsedRep,
  fieldPath: string,
  sep: Separators,
  version: string | undefined,
): TokenNode[] {
  if (rep.components.length <= 1) return [];
  return rep.components.map((comp, idx) => {
    const compPath = `${fieldPath}.${idx + 1}`;
    const children = buildSubcomponentNodes(comp, compPath, version);
    return {
      path: compPath,
      label: getLabel(compPath, version),
      kind: "component" as const,
      value: serializeComponent(comp, sep),
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

function buildFieldNode(
  field: ParsedField,
  fieldPath: string,
  sep: Separators,
  version: string | undefined,
  redaction?: TokenNode["redaction"],
): TokenNode {
  const value = serializeField(field, sep);
  const node: TokenNode = {
    path: fieldPath,
    label: getLabel(fieldPath, version),
    kind: "field",
    value,
  };
  if (redaction) {
    node.redaction = redaction;
  } else if (field.reps.length === 1) {
    // Only build component children for single-rep, non-redacted fields. Multi-rep
    // expansion would need a "repetition" kind which isn't in the contract; for v1
    // multi-rep fields render as a single joined value.
    const compNodes = buildComponentNodes(field.reps[0]!, fieldPath, sep, version);
    if (compNodes.length > 0) {
      node.children = compNodes;
    }
  }
  return node;
}

function redactSegment(seg: ParsedSegment, ctx: WalkContext): TokenNode {
  const fieldNodes: TokenNode[] = [];
  // For non-MSH segments the segment name is at index 0; fields run 1..N.
  // For MSH the synthetic MSH-1 (field separator) is intentionally skipped from
  // tree output but kept in the AST for round-trip serialization.
  const isMSH = seg.name === "MSH";
  const startIdx = isMSH ? 2 : 1;
  for (let i = startIdx; i < seg.fields.length; i++) {
    const field = seg.fields[i];
    if (!field) continue;
    const fieldPath = `${seg.name}-${i}`;

    // Skip empty fields entirely from the tree to keep it readable; they're still
    // serialized correctly because the AST holds the placeholder.
    const isEmpty =
      field.reps.length === 1 &&
      field.reps[0]!.components.length === 1 &&
      field.reps[0]!.components[0]!.subcomponents.length === 1 &&
      field.reps[0]!.components[0]!.subcomponents[0] === "";
    if (isEmpty) continue;

    const rule = matchRule(ctx.ruleset, fieldPath);
    if (rule) {
      const originalLength = serializeField(field, ctx.separators).length;
      applyFieldRedaction(field, fieldPath, rule, ctx);
      const strategy = rule.strategy ?? DEFAULT_STRATEGIES[rule.category];
      fieldNodes.push(
        buildFieldNode(field, fieldPath, ctx.separators, ctx.version, {
          rule: rule.rule,
          category: rule.category,
          strategy,
          originalLength,
        }),
      );
      continue;
    }
    fieldNodes.push(
      buildFieldNode(field, fieldPath, ctx.separators, ctx.version),
    );
  }

  return {
    path: seg.name,
    label: getLabel(seg.name, ctx.version),
    kind: "segment",
    value: null,
    children: fieldNodes,
  };
}

function redactImpl(
  parsed: ParsedMessage,
  ruleset: RulePack,
  redactor: Redactor,
): WalkerResult {
  const ctx: WalkContext = {
    ruleset,
    redactor,
    separators: parsed.separators,
    findings: [],
    version: parsed.version,
  };

  const segmentNodes: TokenNode[] = parsed.segments.map((seg) =>
    redactSegment(seg, ctx),
  );

  const tree: TokenTree = { format: "hl7v2", nodes: segmentNodes };
  const redacted = serializeMessage(parsed);

  return {
    redacted,
    tree,
    findings: ctx.findings,
    parseErrors: [],
  };
}

// -----------------------------------------------------------------------------
// Walker export
// -----------------------------------------------------------------------------

export const hl7v2Walker: Walker<ParsedMessage> = {
  format: "hl7v2",
  parse,
  redact: redactImpl,
};
