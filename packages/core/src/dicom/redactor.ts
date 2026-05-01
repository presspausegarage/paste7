// DICOM SR header redactor factory.
//
// The walker, rule pack, and serializer land in Phase 3 steps 1–3.
// Step 0b ships the API shape so the UI scaffold (step 4) and tests can
// pin against a stable surface while the implementation fills in.

import type { DicomRedactor, DicomRedactorConfig } from "./types.js";

/**
 * Create a DICOM SR header redactor. Phase 3 stub — `redactSrHeaders`
 * throws `NOT_IMPLEMENTED` until the walker lands in step 2.
 *
 * Config is captured up front so the factory's call shape doesn't change
 * when the implementation arrives.
 */
export function createDicomRedactor(config?: DicomRedactorConfig): DicomRedactor {
  // Capture the config so the type compiles cleanly today and the eventual
  // implementation has a consistent reference. No fields read yet.
  void config;

  return {
    async redactSrHeaders(_input: Uint8Array): Promise<never> {
      throw new Error(
        "createDicomRedactor: redactSrHeaders not yet implemented (Phase 3 step 2)",
      );
    },
    reset(): void {
      // No state until step 2 wires the redactor + UID cache.
    },
  };
}
