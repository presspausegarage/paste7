export type WorkflowId = "scratchpad" | "dicom";

export interface WorkflowMeta {
  id: WorkflowId;
  /** Full name for the tooltip headline. */
  label: string;
  /** Single-character glyph for the icon-rail sidebar. */
  glyph: string;
  /** Caption-styled sub-label shown under the tooltip headline. */
  sub: string;
  /** Hover tooltip body text (sentence-form). */
  description: string;
}

export const WORKFLOWS: readonly WorkflowMeta[] = [
  {
    id: "scratchpad",
    label: "Scratchpad",
    glyph: "⎘",
    sub: "Paste & redact",
    description:
      "Paste HL7 v2, HL7 v3, C-CDA, or FHIR (JSON/XML); see it tokenized and redacted.",
  },
  {
    id: "dicom",
    label: "DICOM SR",
    glyph: "⌹",
    sub: "File drop",
    description: "Drop a DICOM SR file; inspect headers and export a sanitized copy.",
  },
] as const;
