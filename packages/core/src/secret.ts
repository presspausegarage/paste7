// Branded wrapper for message content that must never be persisted to disk.
//
// Wraps redacted message text as it flows from the redaction engine into a
// UI layer's own state. The wrapped value is backed by a real ES private
// field (`#value`, not TypeScript's `private` keyword): `JSON.stringify`
// only walks enumerable own properties, and `#value` is neither enumerable
// nor visible outside the class, so `JSON.stringify(new SecretValue(x))`
// produces `{}` -- there is nothing for a stray serialization call to leak
// at runtime.
//
// The primary guard is at the type level, though: `SecretValue<T>` is
// structurally opaque (no public fields, no `toJSON`), so it is not
// assignable to `Persistable`, the JSON-safe shape the settings-persistence
// boundary (see packages/app/src/shared/settings.ts) requires. Adding a
// `SecretValue`-typed field to a `Persistable`-constrained interface (e.g.
// AppSettings) is a compile error, not a leak caught in review.
//
// Deliberately UI-agnostic -- lives in @paste7/core so the same guard is
// available to the Tauri desktop app today and the Phase 7 local MCP server.
export class SecretValue<T> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  /** Explicit, greppable escape hatch. The only way to get the raw value back. */
  reveal(): T {
    return this.#value;
  }

  /** Never the raw value -- guards against template-literal coercion leaking content into logs. */
  toString(): string {
    return "[SecretValue]";
  }

  // No toJSON(). See module comment: absence is load-bearing.
}

/** Convenience constructor -- `secret(x)` reads better than `new SecretValue(x)` at call sites. */
export function secret<T>(value: T): SecretValue<T> {
  return new SecretValue(value);
}

/**
 * JSON-safe value shape. Anything satisfying this can be handed to
 * `JSON.stringify` or a settings-persistence call without risk. `SecretValue`
 * is deliberately not a member of this union: it has no public fields and no
 * `toJSON`, so a `Persistable`-typed parameter rejects it at compile time
 * rather than silently serializing `{}` or throwing at runtime.
 */
export type Persistable =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<Persistable>
  | { readonly [key: string]: Persistable };
