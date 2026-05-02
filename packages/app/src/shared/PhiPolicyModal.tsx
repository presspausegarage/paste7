import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

interface PolicyRow {
  category: string;
  identifier: string;
  strategy: "substitute" | "scrub" | "remove" | "flag-only";
  notes: string;
}

const HIPAA_18: ReadonlyArray<PolicyRow> = [
  { category: "name", identifier: "name", strategy: "substitute", notes: "Patient & provider names → deterministic Norse-pool fakes" },
  { category: "id", identifier: "id", strategy: "substitute", notes: "MRN, account, SSN, NPI → sequential fakes preserving shape" },
  { category: "address", identifier: "address", strategy: "substitute", notes: "Street/city → Midgard pool; state/zip preserved when safe" },
  { category: "date", identifier: "date", strategy: "substitute", notes: "Dates anchored to 1950-01-01 in input format" },
  { category: "phone", identifier: "phone", strategy: "substitute", notes: "555-01XX NANP fictional range, original shape preserved" },
  { category: "email", identifier: "email", strategy: "substitute", notes: "user-NNNN@placeholder.invalid (RFC 6761 reserved)" },
  { category: "url", identifier: "url", strategy: "substitute", notes: "https://placeholder.invalid/r/NNNN" },
  { category: "geo", identifier: "geo", strategy: "scrub", notes: "Sub-state geographic data" },
  { category: "id", identifier: "ssn", strategy: "substitute", notes: "Social security numbers — 000-00-NNNN fakes" },
  { category: "id", identifier: "npi", strategy: "substitute", notes: "National provider identifiers" },
  { category: "device-id", identifier: "device", strategy: "substitute", notes: "Device identifiers & serial numbers" },
  { category: "biometric", identifier: "biometric", strategy: "scrub", notes: "Biometric identifiers (fingerprint, voice)" },
  { category: "photo", identifier: "photo", strategy: "scrub", notes: "Full-face photos and comparable images" },
  { category: "id", identifier: "acct", strategy: "substitute", notes: "Account numbers" },
  { category: "id", identifier: "cert", strategy: "remove", notes: "Certificate / license numbers" },
  { category: "id", identifier: "vehicle", strategy: "remove", notes: "Vehicle ID and license plates" },
  { category: "id", identifier: "health-plan", strategy: "substitute", notes: "Health plan beneficiary numbers" },
  { category: "free-text", identifier: "note", strategy: "flag-only", notes: "Free-text fields — pattern scan for SSN/phone/email; review by hand" },
];

export function PhiPolicyModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="phi-policy-backdrop" onClick={onClose}>
      <div
        className="phi-policy-modal"
        role="dialog"
        aria-labelledby="phi-policy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="phi-policy-header">
          <div className="phi-policy-header-titles">
            <span className="phi-policy-title" id="phi-policy-title">PHI redaction policy</span>
            <span className="caption caption--accent">HIPAA Safe Harbor — 18 identifiers</span>
          </div>
          <button type="button" className="phi-policy-close" onClick={onClose} aria-label="Close">
            ×&nbsp;close
          </button>
        </header>

        <div className="phi-policy-disclaimer">
          Best-effort de-identification for developer debugging. Not a certified HIPAA Safe Harbor tool. Do not use as a sole de-identification layer.
        </div>

        <div className="phi-policy-table-wrap">
          <table className="phi-policy-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Identifier</th>
                <th>Strategy</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {HIPAA_18.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className={`tree-cat tree-cat-${r.category}`}>{r.category}</span>
                  </td>
                  <td className="phi-policy-cell-id">{r.identifier}</td>
                  <td>
                    <span className={`phi-policy-strategy phi-policy-strategy-${r.strategy}`}>
                      {r.strategy}
                    </span>
                  </td>
                  <td className="phi-policy-cell-notes">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="phi-policy-footer">
          DICOM scope: SR header tags only — no ContentSequence, no pixel data. OCR (Phase 6): HL7 v2 viewer screenshots.
        </footer>
      </div>
    </div>
  );
}
