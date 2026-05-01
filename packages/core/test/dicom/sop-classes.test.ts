import { describe, it, expect } from "vitest";
import {
  KNOWN_SR_SOP_CLASSES,
  SR_SOP_CLASS_PREFIX,
  getSrSopClassName,
  isSrSopClass,
} from "../../src/dicom/sop-classes.js";

describe("isSrSopClass", () => {
  it("accepts every entry in the known SR SOP Class table", () => {
    for (const entry of KNOWN_SR_SOP_CLASSES) {
      expect(isSrSopClass(entry.uid)).toBe(true);
    }
  });

  it("accepts a forward-compat SR UID not yet in the known table", () => {
    // A hypothetical future SR SOP Class UID. The prefix-based validator
    // accepts; the name lookup will return undefined (UI shows the raw UID).
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.88.99")).toBe(true);
  });

  it("rejects non-SR storage SOP Classes", () => {
    // CT Image Storage
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.2")).toBe(false);
    // CR Image Storage
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.1")).toBe(false);
    // Encapsulated PDF Storage (close in number, not in family)
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.104.1")).toBe(false);
    // Modality Performed Procedure Step
    expect(isSrSopClass("1.2.840.10008.3.1.2.3.3")).toBe(false);
  });

  it("rejects an SR-prefix string that has no trailing component", () => {
    expect(isSrSopClass(SR_SOP_CLASS_PREFIX)).toBe(false);
    expect(isSrSopClass(SR_SOP_CLASS_PREFIX.slice(0, -1))).toBe(false);
  });

  it("rejects malformed UIDs", () => {
    expect(isSrSopClass("")).toBe(false);
    expect(isSrSopClass("not-a-uid")).toBe(false);
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.88.A")).toBe(false);
    // Leading zero in a component (PS 3.5 forbids unless component is just "0")
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.88.011")).toBe(false);
    // Trailing dot
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.88.")).toBe(false);
    // Embedded space
    expect(isSrSopClass("1.2.840.10008.5.1.4.1.1.88.11 ")).toBe(false);
  });

  it("rejects UIDs longer than the 64-char DICOM limit", () => {
    const tooLong = SR_SOP_CLASS_PREFIX + "1".repeat(64);
    expect(tooLong.length).toBeGreaterThan(64);
    expect(isSrSopClass(tooLong)).toBe(false);
  });

  it("returns false for non-string input without throwing", () => {
    expect(isSrSopClass(undefined as unknown as string)).toBe(false);
    expect(isSrSopClass(null as unknown as string)).toBe(false);
    expect(isSrSopClass(123 as unknown as string)).toBe(false);
  });
});

describe("getSrSopClassName", () => {
  it("returns the standardized name for every known UID", () => {
    for (const entry of KNOWN_SR_SOP_CLASSES) {
      expect(getSrSopClassName(entry.uid)).toBe(entry.name);
    }
  });

  it("returns undefined for an unknown SR UID (forward-compat case)", () => {
    expect(getSrSopClassName("1.2.840.10008.5.1.4.1.1.88.99")).toBeUndefined();
  });

  it("returns undefined for non-SR UIDs", () => {
    expect(getSrSopClassName("1.2.840.10008.5.1.4.1.1.2")).toBeUndefined();
  });

  it("returns undefined without throwing for empty / malformed / non-string input", () => {
    expect(getSrSopClassName("")).toBeUndefined();
    expect(getSrSopClassName("not-a-uid")).toBeUndefined();
    expect(getSrSopClassName(undefined as unknown as string)).toBeUndefined();
    expect(getSrSopClassName(null as unknown as string)).toBeUndefined();
  });
});

describe("KNOWN_SR_SOP_CLASSES table", () => {
  it("has every UID start with the SR family prefix", () => {
    for (const entry of KNOWN_SR_SOP_CLASSES) {
      expect(entry.uid.startsWith(SR_SOP_CLASS_PREFIX)).toBe(true);
    }
  });

  it("has no duplicate UIDs", () => {
    const seen = new Set<string>();
    for (const entry of KNOWN_SR_SOP_CLASSES) {
      expect(seen.has(entry.uid)).toBe(false);
      seen.add(entry.uid);
    }
  });

  it("has no duplicate names", () => {
    const seen = new Set<string>();
    for (const entry of KNOWN_SR_SOP_CLASSES) {
      expect(seen.has(entry.name)).toBe(false);
      seen.add(entry.name);
    }
  });
});
