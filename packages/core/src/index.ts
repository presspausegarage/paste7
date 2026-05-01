// @paste7/core — PHI rule-pack engine.
//
// Public surface lands here as Phase 1 modules ship:
//   - engine.ts          orchestrator (detect format, dispatch walker, apply rule pack)
//   - format-detect.ts   heuristic format detection
//   - walkers/{hl7v2,xml,json}.ts
//   - rules/{hl7v2,hl7v3,cda,fhir}.ts
//   - redact.ts          fake-identity substitution, deterministic-per-session
//   - identities.ts      fake-identity pool
//
// Nothing exported yet — pre-Phase-1.

export {};
