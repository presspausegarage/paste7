// Ambient declaration for `dcmjs` — paste7 uses a narrow subset
// (DicomMessage.readFile, DicomMetaDictionary.uid/punctuateTag/
// unpunctuateTag/dictionary, DicomDict.write) and types only the surface
// we touch. The library ships no types of its own.

declare module "dcmjs" {
  /** Per-tag entry in a parsed dataset. */
  export interface DicomTagEntry {
    vr: string;
    /** Decoded value list. Shape depends on VR:
     *  - PN: `[{ Alphabetic: string, Phonetic?: string, Ideographic?: string }]`
     *  - UI / DA / TM / DT / LO / SH / CS / AE / ST / LT / UT: `[string]` (single-value tags) or `string[]` (multi-value).
     *  - SQ: array of nested dataset objects (`Record<string, DicomTagEntry>[]`).
     *  - IS / DS: numeric strings.
     *  - OB / OW / OF / OD: typed-array binary buffers (out of scope for this library; preserved verbatim).
     */
    Value?: unknown[];
    _rawValue?: unknown;
  }

  export type DicomDataset = Record<string, DicomTagEntry>;

  export class DicomDict {
    constructor(meta: DicomDataset);
    /** File Meta Information (group 0002). */
    meta: DicomDataset;
    /** Main dataset (everything outside file meta). */
    dict: DicomDataset;
    /** Serialize to a complete DICOM Part 10 file as an ArrayBuffer. */
    write(): ArrayBuffer;
    upsertTag(tag: string, vr: string, value: unknown): void;
  }

  export interface DicomMessage {
    /** Parse a complete DICOM Part 10 file (preamble + DICM + file meta + dataset). */
    readFile(buffer: ArrayBuffer): DicomDict;
  }

  export interface DicomMetaDictionary {
    /** Convert `00100010` → `(0010,0010)`. */
    punctuateTag(tag: string): string;
    /** Convert `(0010,0010)` → `00100010`. */
    unpunctuateTag(tag: string): string;
    /** Generate a synthetic UID rooted at `2.25.` (UUID-derived OID branch). */
    uid(): string;
    /** Tag dictionary keyed by punctuated form `(GGGG,EEEE)`. */
    dictionary: Record<
      string,
      { tag: string; vr: string; vm: string; name: string; version: string } | undefined
    >;
    sopClassNamesByUID: Record<string, string | undefined>;
    sopClassUIDsByName: Record<string, string | undefined>;
  }

  const dcmjs: {
    data: {
      DicomMessage: DicomMessage;
      DicomDict: typeof DicomDict;
      DicomMetaDictionary: DicomMetaDictionary;
    };
    log: unknown;
    utilities: unknown;
    anonymizer: unknown;
    sr: unknown;
    derivations: unknown;
    normalizers: unknown;
  };

  export default dcmjs;
}
