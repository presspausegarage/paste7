import { PlaceholderView } from "../shared/PlaceholderView.js";

export function DicomView() {
  return (
    <PlaceholderView
      title="DICOM"
      description="Drop a DICOM file to inspect headers and export a sanitized copy. Pixel-data redaction is not supported — header tags only, per DICOM PS 3.15 Basic Application Confidentiality Profile."
      phase="Phase 3"
      bullets={[
        "File drop: accepts .dcm files; metadata read in memory",
        "Header table: tag, VR, value, redacted-value (per PS 3.15)",
        "Export: writes <original>.redacted.dcm next to source",
        "Pixel-data PHI: explicit non-goal (out of scope)",
        "Bulk mode: drop a folder, redact all in one pass",
      ]}
    />
  );
}
