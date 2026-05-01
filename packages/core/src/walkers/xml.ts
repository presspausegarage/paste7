// XML walker — covers HL7 v3 messaging, C-CDA, and FHIR XML.
// See docs/engine-contract.md sections 5 (walker contract) and 6 (rule packs).
//
// Path syntax: XPath-style absolute paths.
//   /ClinicalDocument/recordTarget/patientRole/patient/name/given
//   /Patient/name/given/@value          (FHIR XML attribute-valued leaf)
//
// Repeated siblings (multiple <name> elements) are not indexed in the path —
// a rule that matches "/Patient/name/family" fires for every occurrence.
// Use a regex pattern in the rule pack if positional matching is needed.

import { XMLBuilder, XMLParser } from "fast-xml-parser";

import type {
  Finding,
  Format,
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
// Internal AST: fast-xml-parser's preserveOrder shape
// -----------------------------------------------------------------------------
//
// preserveOrder=true returns an array of single-key objects, where the key is
// the element name and the value is the array of child entries. Attributes
// live in a sibling ":@" property. Text content uses the "#text" pseudo-tag.
//
//   <a x="1">hi <b/></a>
//
// becomes
//
//   [{ a: [ { "#text": "hi " }, { b: [] } ], ":@": { "@_x": "1" } }]

type OrderedNode = { [tagOrSpecial: string]: OrderedNode[] | string | number | boolean | null | Attrs };
type Attrs = Record<string, string | number | boolean>;

interface ParsedXml {
  root: OrderedNode[];
  /** Set by the caller (engine) or detected from the root element + namespace. */
  format: Format;
}

const ATTR_PREFIX = "@_";
const ATTR_KEY = ":@";
const TEXT_KEY = "#text";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  preserveOrder: true,
  parseAttributeValue: false,
  trimValues: false,
  // Security-relevant: never parse external entities. fast-xml-parser does not
  // resolve external DTDs, but be explicit.
  processEntities: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  preserveOrder: true,
  format: false,
  suppressEmptyNode: false,
});

// -----------------------------------------------------------------------------
// Parse
// -----------------------------------------------------------------------------

/**
 * Detect format from the root element + namespace. Mirrors format-detect.ts but
 * scopes to XML formats only — used when the engine hands the walker an XML
 * input without specifying which of hl7v3/cda/fhir-xml it is.
 */
function isStructuralKey(key: string): boolean {
  // fast-xml-parser surfaces processing instructions ("?xml") and special keys
  // (":@", "#text") that aren't actual element tags.
  return key === ATTR_KEY || key === TEXT_KEY || key.startsWith("?") || key.startsWith("!");
}

function detectFormat(root: OrderedNode[]): Format {
  for (const entry of root) {
    for (const key of Object.keys(entry)) {
      if (isStructuralKey(key)) continue;
      const localName = key.includes(":") ? key.split(":")[1]! : key;
      const attrs = (entry[ATTR_KEY] as Attrs | undefined) ?? {};
      const ns =
        (attrs[`${ATTR_PREFIX}xmlns`] as string | undefined) ?? "";
      if (localName === "ClinicalDocument") return "cda";
      if (typeof ns === "string" && ns.includes("http://hl7.org/fhir"))
        return "fhir-xml";
      if (typeof ns === "string" && ns.includes("urn:hl7-org:v3")) return "hl7v3";
      return "fhir-xml";
    }
  }
  return "fhir-xml";
}

export function parse(input: string): {
  parsed: ParsedXml;
  parseErrors: ReadonlyArray<ParseError>;
} {
  const parseErrors: ParseError[] = [];
  let root: OrderedNode[];
  try {
    root = parser.parse(input) as OrderedNode[];
  } catch (e) {
    parseErrors.push({
      path: "",
      severity: "error",
      message: `XML parse failed: ${(e as Error).message}`,
    });
    return {
      parsed: { root: [], format: "fhir-xml" },
      parseErrors,
    };
  }
  const format = detectFormat(root);
  return { parsed: { root, format }, parseErrors };
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
// Walk
// -----------------------------------------------------------------------------

interface WalkContext {
  ruleset: RulePack;
  redactor: Redactor;
  findings: Finding[];
}

function applyRule(
  rawValue: string,
  path: string,
  rule: Rule,
  ctx: WalkContext,
): { newValue: string | null; redactionMeta: NonNullable<TokenNode["redaction"]> } {
  const strategy = rule.strategy ?? DEFAULT_STRATEGIES[rule.category];

  if (rule.category === "free-text") {
    const scanFindings = ctx.redactor.scanFreeText({
      value: rawValue,
      path,
      rule: rule.rule,
    });
    ctx.findings.push(...scanFindings);
  }

  const response = ctx.redactor.apply({
    category: rule.category,
    value: rawValue,
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
      originalLength: rawValue.length,
    },
  };
}

/** Apply redaction to attributes on this element. Mutates `attrs` in place and
 *  returns child TokenNodes for any attribute that exists. */
function redactAttributes(
  attrs: Attrs,
  parentPath: string,
  ctx: WalkContext,
): TokenNode[] {
  const nodes: TokenNode[] = [];
  for (const rawKey of Object.keys(attrs)) {
    const attrName = rawKey.startsWith(ATTR_PREFIX)
      ? rawKey.slice(ATTR_PREFIX.length)
      : rawKey;
    if (attrName === "xmlns" || attrName.startsWith("xmlns:")) {
      // Namespace declarations are structural; preserve verbatim.
      continue;
    }
    const attrPath = `${parentPath}/@${attrName}`;
    const value = String(attrs[rawKey]);
    const rule = matchRule(ctx.ruleset, attrPath);
    if (rule) {
      const { newValue, redactionMeta } = applyRule(value, attrPath, rule, ctx);
      attrs[rawKey] = newValue ?? "";
      nodes.push({
        path: attrPath,
        label: `@${attrName}`,
        kind: "attribute",
        value: newValue,
        redaction: redactionMeta,
      });
    } else {
      nodes.push({
        path: attrPath,
        label: `@${attrName}`,
        kind: "attribute",
        value,
      });
    }
  }
  return nodes;
}

/** True iff the children list is purely a single text node (mixed-content leaf). */
function isPureTextElement(
  children: OrderedNode[],
): { text: string; index: number } | null {
  let textIdx = -1;
  let text = "";
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const keys = Object.keys(child).filter((k) => k !== ATTR_KEY);
    if (keys.length === 1 && keys[0] === TEXT_KEY) {
      if (textIdx >= 0) return null; // multiple text nodes — not "pure"
      textIdx = i;
      text = String(child[TEXT_KEY]);
    } else {
      return null; // child element present
    }
  }
  if (textIdx === -1) return null;
  return { text, index: textIdx };
}

interface ChildWalkOutcome {
  nodes: TokenNode[];
}

function walkElement(
  entry: OrderedNode,
  parentPath: string,
  ctx: WalkContext,
): TokenNode | null {
  const tag = Object.keys(entry).find((k) => !isStructuralKey(k));
  if (!tag) return null;

  const localName = tag.includes(":") ? tag.split(":")[1]! : tag;
  const elementPath = `${parentPath}/${localName}`;
  const children = (entry[tag] as OrderedNode[]) ?? [];
  const attrs = (entry[ATTR_KEY] as Attrs | undefined) ?? undefined;

  const childNodes: TokenNode[] = [];

  if (attrs) {
    childNodes.push(...redactAttributes(attrs, elementPath, ctx));
  }

  // Pure-text leaf: try to match rule on element path itself.
  const pureText = isPureTextElement(children);
  if (pureText) {
    const rule = matchRule(ctx.ruleset, elementPath);
    if (rule) {
      const { newValue, redactionMeta } = applyRule(
        pureText.text,
        elementPath,
        rule,
        ctx,
      );
      // Mutate the underlying text node so serialization reflects redaction.
      const textNode = children[pureText.index]!;
      textNode[TEXT_KEY] = newValue ?? "";
      return {
        path: elementPath,
        label: localName,
        kind: "element",
        value: newValue,
        redaction: redactionMeta,
        ...(childNodes.length > 0 ? { children: childNodes } : {}),
      };
    }
    return {
      path: elementPath,
      label: localName,
      kind: "element",
      value: pureText.text,
      ...(childNodes.length > 0 ? { children: childNodes } : {}),
    };
  }

  // Non-leaf element: recurse into children.
  const sub = walkChildren(children, elementPath, ctx);
  for (const node of sub.nodes) childNodes.push(node);

  return {
    path: elementPath,
    label: localName,
    kind: "element",
    value: null,
    ...(childNodes.length > 0 ? { children: childNodes } : {}),
  };
}

function walkChildren(
  children: OrderedNode[],
  parentPath: string,
  ctx: WalkContext,
): ChildWalkOutcome {
  const nodes: TokenNode[] = [];
  for (const child of children) {
    const node = walkElement(child, parentPath, ctx);
    if (node) nodes.push(node);
  }
  return { nodes };
}

// -----------------------------------------------------------------------------
// Redact entry point
// -----------------------------------------------------------------------------

function redactImpl(
  parsed: ParsedXml,
  ruleset: RulePack,
  redactor: Redactor,
): WalkerResult {
  const ctx: WalkContext = { ruleset, redactor, findings: [] };
  const sub = walkChildren(parsed.root, "", ctx);

  const tree: TokenTree = { format: parsed.format, nodes: sub.nodes };
  const redacted = builder.build(parsed.root) as string;

  return {
    redacted,
    tree,
    findings: ctx.findings,
    parseErrors: [],
  };
}

// -----------------------------------------------------------------------------
// Walker exports — one logical walker, registered for three Format ids
// -----------------------------------------------------------------------------

export const xmlWalker: Walker<ParsedXml> = {
  format: ["hl7v3", "cda", "fhir-xml"],
  parse,
  redact: redactImpl,
};
