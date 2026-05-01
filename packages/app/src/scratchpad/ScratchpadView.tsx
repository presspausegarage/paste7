import { PlaceholderView } from "../shared/PlaceholderView.js";

export function ScratchpadView() {
  return (
    <PlaceholderView
      title="Scratchpad"
      description="Paste HL7 v2, HL7 v3, C-CDA, or FHIR (JSON or XML); see it tokenized with PHI auto-redacted in real time. In-memory only; pasted content is never written to disk."
      phase="Phase 2 (PHI engine lands in Phase 1)"
      bullets={[
        "Paste area: Monaco editor with format auto-detect",
        "Redacted view: PHI auto-masked; free-text PHI flagged",
        "Findings panel: per-format structural validation, PHI flags",
        "Copy prompt: original vs. redacted (default: redacted)",
        "Status bar: PHI mode ON, always, non-toggleable",
      ]}
    />
  );
}
