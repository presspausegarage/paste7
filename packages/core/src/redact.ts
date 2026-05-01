// Redactor implementation. See docs/engine-contract.md sections 7 (substitution
// algorithm) and 8 (free-text scanning).
//
// One Redactor instance lives one session: each Engine.redact() call asks the
// engine for one (or the engine reuses one across the session). Bindings persist
// for the instance's lifetime so the same original PHI value gets the same fake
// across multiple paste actions in the same session.

import type {
  Finding,
  FreeTextScanRequest,
  IdentityPool,
  PHICategory,
  Redactor,
  RedactRequest,
  RedactResponse,
} from "./types.js";

import { DEFAULT_POOL } from "./identities.js";

// -----------------------------------------------------------------------------
// Internal session state
// -----------------------------------------------------------------------------

interface SessionState {
  pool: IdentityPool;
  /** Bindings: hashKey(category, value) -> fake. Hashed so a heap dump doesn't
   *  trivially expose the originals as map keys. The originals are also held
   *  transiently in the walker AST and Monaco buffer; the hash narrows the
   *  attack surface, it doesn't eliminate it. */
  bindings: Map<string, string>;
  /** Sequential counters per fake-format. */
  counters: Counters;
  /** Position into pool.names for sequential allocation. */
  namesCursor: number;
  streetsCursor: number;
  citiesCursor: number;
}

interface Counters {
  mrn: number;
  ssn: number;
  account: number;
  generic: number;
  phone: number;
  email: number;
  url: number;
  device: number;
  postal: number;
}

function freshState(pool: IdentityPool): SessionState {
  return {
    pool,
    bindings: new Map(),
    counters: {
      mrn: 0,
      ssn: 0,
      account: 0,
      generic: 0,
      phone: 0,
      email: 0,
      url: 0,
      device: 0,
      postal: 0,
    },
    namesCursor: 0,
    streetsCursor: 0,
    citiesCursor: 0,
  };
}

// -----------------------------------------------------------------------------
// Hash key (FNV-1a 64-bit)
// -----------------------------------------------------------------------------
//
// FNV-1a is sync, dependency-free, and one-way enough to satisfy the contract's
// "don't trivially expose originals" intent. Cryptographic strength is NOT
// required: an attacker with heap access already has the originals from the
// walker AST and the Monaco buffer; the binding map hash just removes one
// trivially-grep-able copy.

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

function hashKey(category: string, value: string): string {
  const input = `${category}\x00${value}`;
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * FNV_PRIME) & FNV_MASK;
  }
  return h.toString(16).padStart(16, "0");
}

// -----------------------------------------------------------------------------
// Shape detection — what the value LOOKS like determines what we emit.
// -----------------------------------------------------------------------------

const RE_SSN = /^\d{3}-\d{2}-\d{4}$/;
const RE_PHONE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\(\d{3}\)\s?\d{3}-\d{4}$/, // (407)555-1234 or (407) 555-1234
  /^\d{3}-\d{3}-\d{4}$/, // 407-555-1234
  /^\d{3}\.\d{3}\.\d{4}$/, // 407.555.1234
  /^\d{10}$/, // 4075551234
  /^\d{3}-\d{4}$/, // 555-1234
  /^\+\d{1,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}$/, // +1-407-555-1234
];
const RE_EMAIL = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
const RE_URL = /^https?:\/\//i;
const RE_HL7_DATE = /^\d{8}(\d{6}(\.\d+)?)?([+-]\d{4})?$/; // YYYYMMDD[HHMMSS[.ffff]][zone]
const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const RE_5DIGIT = /^\d{5}$/;
const RE_ZIP_PLUS_4 = /^\d{5}-\d{4}$/;
const RE_2ALPHA = /^[A-Z]{2}$/;
const RE_STREET_LIKE = /^\d+\s+\S/;
const RE_LIKELY_MRN = /^[A-Z]{0,4}\d{3,}$/i;
const RE_GEO = /^[+-]?\d+(\.\d+)?[, ]\s*[+-]?\d+(\.\d+)?$/;
const RE_DEVICE = /^[A-Z0-9-]{4,}$/i;

function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

function pad5(n: number): string {
  return n.toString().padStart(5, "0");
}

// -----------------------------------------------------------------------------
// Generators per category (substitute strategy)
// -----------------------------------------------------------------------------

function nextNamePair(state: SessionState): { family: string; given: string } {
  const pool = state.pool.names;
  if (pool.length === 0) return { family: "FAMILY", given: "GIVEN" };
  const idx = state.namesCursor % pool.length;
  const wrap = Math.floor(state.namesCursor / pool.length);
  state.namesCursor++;
  const pair = pool[idx]!;
  if (wrap === 0) return { family: pair.family, given: pair.given };
  // Wrap: append numeric suffix so binding-uniqueness is preserved.
  return {
    family: `${pair.family}_${wrap + 1}`,
    given: `${pair.given}_${wrap + 1}`,
  };
}

function nextStreet(state: SessionState): string {
  const pool = state.pool.streetAddresses;
  if (pool.length === 0) return "1 FAKE STREET";
  const idx = state.streetsCursor % pool.length;
  const wrap = Math.floor(state.streetsCursor / pool.length);
  state.streetsCursor++;
  return wrap === 0 ? pool[idx]! : `${pool[idx]!}_${wrap + 1}`;
}

function nextCity(state: SessionState): string {
  const pool = state.pool.cities;
  if (pool.length === 0) return "FAKETOWN";
  const idx = state.citiesCursor % pool.length;
  const wrap = Math.floor(state.citiesCursor / pool.length);
  state.citiesCursor++;
  return wrap === 0 ? pool[idx]! : `${pool[idx]!}_${wrap + 1}`;
}

function generateName(value: string, state: SessionState): string {
  // HL7 v2 XPN: FAMILY^GIVEN^MIDDLE^SUFFIX^PREFIX^DEGREE
  if (value.includes("^")) {
    const components = value.split("^");
    const pair = nextNamePair(state);
    const out: string[] = components.map((comp, idx) => {
      if (comp.length === 0) return "";
      switch (idx) {
        case 0:
          return pair.family;
        case 1:
          return pair.given;
        case 2:
          // Middle initial / middle name. Use first letter of given.
          return pair.given[0] ?? "X";
        default:
          // Suffix/prefix/degree: blank out, structurally fine.
          return "";
      }
    });
    return out.join("^");
  }
  // Single-token name: emit family component of the next pair.
  const pair = nextNamePair(state);
  return pair.family;
}

function generateAddress(value: string, state: SessionState): string {
  // HL7 v2 XAD: STREET^OTHER^CITY^STATE^ZIP^COUNTRY^TYPE^...
  if (value.includes("^")) {
    const components = value.split("^");
    const street = nextStreet(state);
    const city = nextCity(state);
    state.counters.postal++;
    const zip = pad5(state.counters.postal);
    const out = components.map((comp, idx) => {
      if (comp.length === 0) return "";
      switch (idx) {
        case 0:
          return street;
        case 1:
          return ""; // other-designation
        case 2:
          return city;
        case 3:
          return "XX";
        case 4:
          return zip;
        default:
          return "";
      }
    });
    return out.join("^");
  }

  // Single-string address sub-part: detect what kind from shape.
  if (RE_5DIGIT.test(value)) {
    state.counters.postal++;
    return pad5(state.counters.postal);
  }
  if (RE_ZIP_PLUS_4.test(value)) {
    state.counters.postal++;
    return `${pad5(state.counters.postal)}-0000`;
  }
  if (RE_2ALPHA.test(value)) return "XX";
  if (RE_STREET_LIKE.test(value)) return nextStreet(state);
  // Default: city
  return nextCity(state);
}

function generateIdLeaf(value: string, state: SessionState): string {
  if (RE_SSN.test(value)) {
    state.counters.ssn++;
    return `000-00-${pad4(state.counters.ssn)}`;
  }
  // 9-consecutive-digits SSN-without-dashes → still produce dashed fake.
  if (/^\d{9}$/.test(value)) {
    state.counters.ssn++;
    return `00000${pad4(state.counters.ssn)}`;
  }
  if (RE_LIKELY_MRN.test(value)) {
    state.counters.mrn++;
    return `MRN-FAKE-${pad4(state.counters.mrn)}`;
  }
  // Account-style or other identifier: generic fake.
  state.counters.account++;
  return `ID-FAKE-${pad4(state.counters.account)}`;
}

function generateId(value: string, state: SessionState): string {
  // HL7 v2 CX type: ID^CHECK^ASSIGNING-AUTHORITY^ID-TYPE^...
  // Only component 1 (and arguably 2, the check digit) is PHI; the assigning
  // authority and type code describe the source system and are not Safe Harbor
  // identifiers. Preserve trailing components verbatim.
  if (value.includes("^")) {
    const parts = value.split("^");
    const idPart = parts[0] ?? "";
    parts[0] = idPart.length === 0 ? "" : generateIdLeaf(idPart, state);
    return parts.join("^");
  }
  return generateIdLeaf(value, state);
}

function generatePhone(value: string, state: SessionState): string {
  state.counters.phone++;
  // 555-01XX is the NANP fictional range. 100 unique values per pool wrap;
  // wrap by appending a suffix block.
  const n = state.counters.phone;
  const last = pad4(100 + ((n - 1) % 100));
  // Mirror the input shape so downstream parsers don't reject a re-shaped value.
  if (/^\+/.test(value)) return `+1-555-555-${last}`;
  if (/^\(\d{3}\)/.test(value)) return `(555) 555-${last}`;
  if (/^\d{3}-\d{3}-\d{4}$/.test(value)) return `555-555-${last}`;
  if (/^\d{3}\.\d{3}\.\d{4}$/.test(value)) return `555.555.${last}`;
  if (/^\d{10}$/.test(value)) return `5555550000`.slice(0, 10 - 4) + last;
  if (/^\d{3}-\d{4}$/.test(value)) return `555-${last}`;
  // Default: dashed full-form
  return `555-555-${last}`;
}

function generateEmail(state: SessionState): string {
  state.counters.email++;
  return `user-${pad4(state.counters.email)}@placeholder.invalid`;
}

function generateDate(value: string): string {
  // Safe Harbor: dates more precise than year for ages > 89 must be removed.
  // Simple baseline: 1950-01-01 in the input's format.
  if (RE_HL7_DATE.test(value)) {
    // Match the precision of the original.
    const len = value.replace(/[+-]\d{4}$/, "").replace(".", "").length;
    if (len <= 8) return "19500101";
    if (len <= 14) return "19500101000000";
    return "19500101000000.0000";
  }
  if (RE_ISO_DATE.test(value)) {
    if (value.length <= 10) return "1950-01-01";
    if (value.endsWith("Z")) return "1950-01-01T00:00:00Z";
    return "1950-01-01T00:00:00";
  }
  return "1950-01-01";
}

function generateUrl(state: SessionState): string {
  state.counters.url++;
  return `https://placeholder.invalid/r/${pad4(state.counters.url)}`;
}

function generateDeviceId(state: SessionState): string {
  state.counters.device++;
  return `DEV-FAKE-${pad4(state.counters.device)}`;
}

function generateGeo(value: string): string {
  // Preserve separator if comma vs space.
  if (/^[+-]?\d+(\.\d+)?\s+[+-]?\d+(\.\d+)?$/.test(value)) return "0.0 0.0";
  return "0.0,0.0";
}

function generateFake(
  category: PHICategory,
  value: string,
  state: SessionState,
): string {
  switch (category) {
    case "name":
      return generateName(value, state);
    case "id":
      return generateId(value, state);
    case "address":
      return generateAddress(value, state);
    case "phone":
      return generatePhone(value, state);
    case "email":
      // Email substitution ignores input shape — placeholder.invalid is
      // intentionally non-deliverable per RFC 6761.
      return generateEmail(state);
    case "date":
      return generateDate(value);
    case "geo":
      return generateGeo(value);
    case "device-id":
      return generateDeviceId(state);
    case "url":
      return generateUrl(state);
    case "biometric":
    case "photo":
      // Substitute makes no sense for binary blobs; fall through to scrub.
      return "[REDACTED]";
    case "free-text":
      // Free-text substitute is rare (default is flag-only). When invoked,
      // emit a single placeholder; preserves length-of-original in finding.
      return "[REDACTED]";
  }
}

// -----------------------------------------------------------------------------
// Free-text scanning (engine-contract section 8)
// -----------------------------------------------------------------------------

const FREE_TEXT_SCANNERS: ReadonlyArray<{
  pattern: RegExp;
  category: PHICategory;
}> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, category: "id" },
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, category: "phone" },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, category: "email" },
];

function scanFreeText(
  req: FreeTextScanRequest,
  _state: SessionState,
): ReadonlyArray<Finding> {
  const out: Finding[] = [];
  for (const { pattern, category } of FREE_TEXT_SCANNERS) {
    // Reset lastIndex on the source regex copy each call.
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(req.value)) !== null) {
      out.push({
        path: req.path,
        category,
        strategy: "flag-only",
        redactedValue: m[0],
        originalLength: m[0].length,
        rule: req.rule,
        confidence: 0.85,
      });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Strategy dispatch
// -----------------------------------------------------------------------------

function scrubFor(_category: PHICategory): string {
  return "[REDACTED]";
}

function applySubstitute(
  category: PHICategory,
  value: string,
  state: SessionState,
): string {
  const key = hashKey(category, value);
  const existing = state.bindings.get(key);
  if (existing !== undefined) return existing;
  const fake = generateFake(category, value, state);
  state.bindings.set(key, fake);
  return fake;
}

// -----------------------------------------------------------------------------
// Public factory
// -----------------------------------------------------------------------------

export interface RedactorOptions {
  pool?: IdentityPool;
}

/**
 * Build a Redactor backed by a fresh session state. Bindings persist for the
 * lifetime of the returned object. Call `reset()` (via the engine) to start a
 * new session.
 */
export function createRedactor(options: RedactorOptions = {}): Redactor & {
  reset(): void;
  size(): number;
} {
  const pool = options.pool ?? DEFAULT_POOL;
  let state = freshState(pool);

  return {
    apply(req: RedactRequest): RedactResponse {
      let value: string | null;
      switch (req.strategy) {
        case "remove":
          value = null;
          break;
        case "scrub":
          value = scrubFor(req.category);
          break;
        case "flag-only":
          value = req.value;
          break;
        case "substitute":
          value = applySubstitute(req.category, req.value, state);
          break;
      }
      return {
        value,
        finding: {
          path: req.path,
          category: req.category,
          strategy: req.strategy,
          rule: req.rule,
          originalLength: req.value.length,
          confidence: 1,
          redactedValue: value,
        },
      };
    },
    scanFreeText(req: FreeTextScanRequest): ReadonlyArray<Finding> {
      return scanFreeText(req, state);
    },
    reset(): void {
      state = freshState(pool);
    },
    size(): number {
      return state.bindings.size;
    },
  };
}
