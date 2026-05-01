export type WorkflowId = "scratchpad" | "dicom";

export type WorkflowGroup = "paste" | "file";

export interface WorkflowMeta {
  id: WorkflowId;
  label: string;
  group: WorkflowGroup;
  shortLabel: string;
  description: string;
}

export const WORKFLOWS: readonly WorkflowMeta[] = [
  {
    id: "scratchpad",
    label: "Scratchpad",
    shortLabel: "Paste",
    group: "paste",
    description:
      "Paste HL7 v2, HL7 v3, C-CDA, or FHIR (JSON/XML); see it tokenized and redacted.",
  },
  {
    id: "dicom",
    label: "DICOM",
    shortLabel: "DICOM",
    group: "file",
    description: "Drop a DICOM file; inspect headers and export a sanitized copy.",
  },
] as const;

export const GROUP_LABELS: Record<WorkflowGroup, string> = {
  paste: "Paste",
  file: "File",
};
