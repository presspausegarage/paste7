// FHIR JSON walker. See docs/engine-contract.md sections 5 (walker contract) and 6 (rule packs).
//
// Path syntax: dot-bracket on top of the resourceType.
//   Patient.name[0].given[0]
//   Bundle.entry[2].resource.identifier[0].value
//
// Rules in this walker target *leaf* paths (string/number/boolean values).
// Object-level rules don't apply here because the Redactor returns strings,
// not structured subtrees — drill down to the leaves you want redacted.

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

// -----------------------------------------------------------------------------
// Internal AST: opaque JSON value plus its detected resource root
// -----------------------------------------------------------------------------

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

interface ParsedJson {
  value: JsonValue;
  /** Top-level resource label used as the path root ("Patient", "Bundle", ...). */
  rootLabel: string;
}

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

export function parse(input: string): {
  parsed: ParsedJson;
  parseErrors: ReadonlyArray<ParseError>;
} {
  const parseErrors: ParseError[] = [];
  let value: JsonValue;
  try {
    value = JSON.parse(input) as JsonValue;
  } catch (e) {
    parseErrors.push({
      path: "",
      severity: "error",
      message: `JSON parse failed: ${(e as Error).message}`,
    });
    return {
      parsed: { value: {}, rootLabel: "Resource" },
      parseErrors,
    };
  }

  let rootLabel = "Resource";
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rt = (value as Record<string, unknown>).resourceType;
    if (typeof rt === "string") {
      rootLabel = rt;
    } else {
      parseErrors.push({
        path: "",
        severity: "warning",
        message:
          "Top-level object has no resourceType field; using 'Resource' as path root.",
      });
    }
  } else if (Array.isArray(value)) {
    rootLabel = "Array";
    parseErrors.push({
      path: "",
      severity: "warning",
      message:
        "Top-level value is an array (collection of resources). Using 'Array' as path root.",
    });
  }

  return { parsed: { value, rootLabel }, parseErrors };
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
// Walk: produces redacted JSON value AND tree nodes in one pass
// -----------------------------------------------------------------------------

interface WalkContext {
  ruleset: RulePack;
  redactor: Redactor;
  findings: Finding[];
}

interface WalkOutcome {
  value: JsonValue;
  node: TokenNode | null;
}

function isLeaf(v: JsonValue): boolean {
  return v === null || typeof v !== "object";
}

function leafToString(v: JsonValue): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function applyLeafRule(
  rawValue: JsonValue,
  path: string,
  rule: Rule,
  ctx: WalkContext,
): { newValue: JsonValue; redactionMeta: NonNullable<TokenNode["redaction"]> } {
  const original = leafToString(rawValue);
  const strategy = rule.strategy ?? DEFAULT_STRATEGIES[rule.category];

  if (rule.category === "free-text") {
    const scanFindings = ctx.redactor.scanFreeText({
      value: original,
      path,
      rule: rule.rule,
    });
    ctx.findings.push(...scanFindings);
  }

  const response = ctx.redactor.apply({
    category: rule.category,
    value: original,
    strategy,
    path,
    rule: rule.rule,
  });
  ctx.findings.push(response.finding);

  return {
    newValue: response.value,
    redactionMeta: {
      rule: rule.rule,
      category: rule.category,
      strategy,
      originalLength: original.length,
    },
  };
}

function walk(
  value: JsonValue,
  path: string,
  label: string,
  ctx: WalkContext,
): WalkOutcome {
  // Leaf node: try to match a rule, build a property/element node.
  if (isLeaf(value)) {
    const rule = matchRule(ctx.ruleset, path);
    if (rule) {
      const { newValue, redactionMeta } = applyLeafRule(value, path, rule, ctx);
      return {
        value: newValue,
        node: {
          path,
          label,
          kind: "property",
          value: newValue === null ? null : leafToString(newValue),
          redaction: redactionMeta,
        },
      };
    }
    return {
      value,
      node: {
        path,
        label,
        kind: "property",
        value: leafToString(value),
      },
    };
  }

  // Array: walk each element with its own [idx] path suffix; element nodes feed
  // into the parent's children list rather than under a synthetic array node so
  // the tree mirrors FHIR's "everything is a list" structure.
  if (Array.isArray(value)) {
    const newArray: JsonValue[] = [];
    const childNodes: TokenNode[] = [];
    for (let i = 0; i < value.length; i++) {
      const childPath = `${path}[${i}]`;
      const childLabel = `${label}[${i}]`;
      const outcome = walk(value[i]!, childPath, childLabel, ctx);
      newArray.push(outcome.value);
      if (outcome.node) childNodes.push(outcome.node);
    }
    return {
      value: newArray,
      node: {
        path,
        label,
        kind: "property",
        value: null,
        ...(childNodes.length > 0 ? { children: childNodes } : {}),
      },
    };
  }

  // Object: walk each property, build child nodes.
  const obj = value as { [k: string]: JsonValue };
  const newObj: { [k: string]: JsonValue } = {};
  const childNodes: TokenNode[] = [];
  for (const key of Object.keys(obj)) {
    const childPath = `${path}.${key}`;
    const outcome = walk(obj[key]!, childPath, key, ctx);
    newObj[key] = outcome.value;
    if (outcome.node) childNodes.push(outcome.node);
  }
  return {
    value: newObj,
    node: {
      path,
      label,
      kind: "property",
      value: null,
      ...(childNodes.length > 0 ? { children: childNodes } : {}),
    },
  };
}

// -----------------------------------------------------------------------------
// Redact entry point
// -----------------------------------------------------------------------------

function redactImpl(
  parsed: ParsedJson,
  ruleset: RulePack,
  redactor: Redactor,
): WalkerResult {
  const ctx: WalkContext = { ruleset, redactor, findings: [] };
  const outcome = walk(parsed.value, parsed.rootLabel, parsed.rootLabel, ctx);

  // Top-level node always exists for object/array roots; for an unusual scalar
  // root it'd be a single property node — still renderable.
  const rootNode = outcome.node;
  const tree: TokenTree = {
    format: "fhir-json",
    nodes: rootNode ? [rootNode] : [],
  };

  // Pretty-print with 2-space indent: matches FHIR convention and makes the
  // raw-text view readable. Newlines stable for round-trip tests.
  const redacted = JSON.stringify(outcome.value, null, 2);

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

export const fhirJsonWalker: Walker<ParsedJson> = {
  format: "fhir-json",
  parse,
  redact: redactImpl,
};
