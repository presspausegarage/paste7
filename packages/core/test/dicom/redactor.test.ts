import { describe, it, expect } from "vitest";
import { createDicomRedactor } from "../../src/dicom/redactor.js";

describe("createDicomRedactor (Phase 3 step 0b stub)", () => {
  it("creates a redactor with the documented surface", () => {
    const r = createDicomRedactor();
    expect(typeof r.redactSrHeaders).toBe("function");
    expect(typeof r.reset).toBe("function");
  });

  it("accepts a config without throwing", () => {
    const r = createDicomRedactor({
      retainDates: true,
      retainUids: false,
      retainDeviceIds: false,
    });
    expect(r).toBeDefined();
  });

  it("throws NOT_IMPLEMENTED when redactSrHeaders is invoked (until step 2 lands)", async () => {
    const r = createDicomRedactor();
    await expect(r.redactSrHeaders(new Uint8Array([0]))).rejects.toThrow(
      /not yet implemented/i,
    );
  });

  it("reset() is a safe no-op pre-implementation", () => {
    const r = createDicomRedactor();
    expect(() => r.reset()).not.toThrow();
  });
});
