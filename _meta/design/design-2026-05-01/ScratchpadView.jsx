// ScratchpadView.jsx — paste7 scratchpad redesign

const { useState, useRef, useCallback } = React;

// ── Fake data for the prototype ──────────────────────────────────────────

const SAMPLE_FINDINGS = [
  { category: "name",    path: "PID-5",       rule: "hl7v2.patient-name",  strategy: "substitute", redactedValue: "SMITH^JOHN^A" },
  { category: "id",      path: "PID-3",       rule: "hl7v2.patient-id",    strategy: "substitute", redactedValue: "MRN-00017742" },
  { category: "date",    path: "PID-7",       rule: "hl7v2.birth-date",    strategy: "substitute", redactedValue: "19800101" },
  { category: "address", path: "PID-11",      rule: "hl7v2.patient-addr",  strategy: "scrub",      redactedValue: null },
  { category: "phone",   path: "PID-13",      rule: "hl7v2.home-phone",    strategy: "remove",     redactedValue: null },
  { category: "id",      path: "PV1-19",      rule: "hl7v2.visit-number",  strategy: "substitute", redactedValue: "VN-00048291" },
  { category: "name",    path: "ORC-12.2",    rule: "hl7v2.provider-name", strategy: "substitute", redactedValue: "JONES^MARY" },
  { category: "id",      path: "OBR-18",      rule: "hl7v2.accession",     strategy: "substitute", redactedValue: "ACC-20240112-0091" },
];

const SAMPLE_TREE = [
  { path: "MSH", label: "Message Header", kind: "segment", value: null, children: [
    { path: "MSH-9", label: "ADT^A01", kind: "field", value: "ADT^A01", redaction: null },
    { path: "MSH-10", label: "20240112093021.874-0500", kind: "field", value: "20240112093021.874-0500", redaction: null },
  ]},
  { path: "PID", label: "Patient Identification", kind: "segment", value: null, children: [
    { path: "PID-3", label: "MRN-00017742", kind: "field", value: "MRN-00017742", redaction: { category: "id", rule: "hl7v2.patient-id" } },
    { path: "PID-5", label: "SMITH^JOHN^A", kind: "field", value: "SMITH^JOHN^A", redaction: { category: "name", rule: "hl7v2.patient-name" } },
    { path: "PID-7", label: "19800101", kind: "field", value: "19800101", redaction: { category: "date", rule: "hl7v2.birth-date" } },
    { path: "PID-8", label: "M", kind: "field", value: "M", redaction: null },
    { path: "PID-11", label: "[scrubbed]", kind: "field", value: null, redaction: { category: "address", rule: "hl7v2.patient-addr" } },
    { path: "PID-13", label: "[removed]", kind: "field", value: null, redaction: { category: "phone", rule: "hl7v2.home-phone" } },
  ]},
  { path: "PV1", label: "Patient Visit", kind: "segment", value: null, children: [
    { path: "PV1-2", label: "I", kind: "field", value: "I", redaction: null },
    { path: "PV1-19", label: "VN-00048291", kind: "field", value: "VN-00048291", redaction: { category: "id", rule: "hl7v2.visit-number" } },
  ]},
  { path: "ORC", label: "Common Order", kind: "segment", value: null, children: [
    { path: "ORC-1", label: "NW", kind: "field", value: "NW", redaction: null },
    { path: "ORC-12.2", label: "JONES^MARY", kind: "field", value: "JONES^MARY", redaction: { category: "name", rule: "hl7v2.provider-name" } },
  ]},
  { path: "OBR", label: "Observation Request", kind: "segment", value: null, children: [
    { path: "OBR-4", label: "71046^Chest X-ray 2V", kind: "field", value: "71046^Chest X-ray 2V", redaction: null },
    { path: "OBR-18", label: "ACC-20240112-0091", kind: "field", value: "ACC-20240112-0091", redaction: { category: "id", rule: "hl7v2.accession" } },
  ]},
];

// ── Category colors ──────────────────────────────────────────────────────

const CAT_STYLE = {
  name:      { color: "var(--blue)",   bg: "var(--blue-soft)",   border: "rgba(92,134,214,0.3)" },
  id:        { color: "var(--blue)",   bg: "var(--blue-soft)",   border: "rgba(92,134,214,0.3)" },
  address:   { color: "var(--amber)",  bg: "rgba(216,138,58,.12)", border: "rgba(216,138,58,.3)" },
  geo:       { color: "var(--amber)",  bg: "rgba(216,138,58,.12)", border: "rgba(216,138,58,.3)" },
  phone:     { color: "var(--accent)", bg: "var(--accent-soft)",  border: "rgba(61,168,142,.3)" },
  email:     { color: "var(--accent)", bg: "var(--accent-soft)",  border: "rgba(61,168,142,.3)" },
  url:       { color: "var(--accent)", bg: "var(--accent-soft)",  border: "rgba(61,168,142,.3)" },
  date:      { color: "var(--amber)",  bg: "rgba(216,138,58,.12)", border: "rgba(216,138,58,.3)" },
  biometric: { color: "#d9534f",       bg: "rgba(217,83,79,.12)", border: "rgba(217,83,79,.3)" },
  photo:     { color: "#d9534f",       bg: "rgba(217,83,79,.12)", border: "rgba(217,83,79,.3)" },
  "free-text": { color: "var(--text-3)", bg: "var(--surface-2)", border: "var(--border-2)" },
};

function catChip(category, size = 9) {
  const s = CAT_STYLE[category] || { color: "var(--text-3)", bg: "var(--surface-2)", border: "var(--border-2)" };
  return {
    display: "inline-block",
    fontFamily: "var(--font-mono)",
    fontSize: size,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 8,
    color: s.color,
    background: s.bg,
    border: `1px solid ${s.border}`,
  };
}

// ── PHI Policy Modal ─────────────────────────────────────────────────────

const HIPAA_18 = [
  ["name",      "name",     "substitute", "Patient & provider names → deterministic fakes"],
  ["id",        "id",       "substitute", "MRN, account, SSN, NPI → sequential fakes"],
  ["address",   "address",  "scrub",      "Street, city, county → removed; state + zip kept if safe"],
  ["date",      "date",     "substitute", "Dates shifted ±offset; age >89 → 90"],
  ["phone",     "phone",    "remove",     "All telephone / fax numbers"],
  ["email",     "email",    "remove",     "Email addresses"],
  ["url",       "url",      "remove",     "Web / IP addresses"],
  ["geo",       "geo",      "scrub",      "Sub-state geographic data"],
  ["id",        "ssn",      "remove",     "Social security numbers"],
  ["id",        "npi",      "substitute", "National provider identifiers"],
  ["device-id", "device",   "substitute", "Device identifiers & serial numbers"],
  ["biometric", "biometric","remove",     "Biometric identifiers (fingerprint, voice)"],
  ["photo",     "photo",    "remove",     "Full-face photos and comparable images"],
  ["id",        "acct",     "substitute", "Account numbers"],
  ["id",        "cert",     "remove",     "Certificate / license numbers"],
  ["id",        "vehicle",  "remove",     "Vehicle ID and license plates"],
  ["id",        "health-plan","substitute","Health plan beneficiary numbers"],
  ["free-text", "note",     "scrub",      "Free-text fields: best-effort scrub"],
];

function PhiPolicyModal({ onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(11,14,24,0.82)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border-2)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-popup)",
        width: 560,
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "14px 18px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>PHI redaction policy</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>HIPAA Safe Harbor — 18 identifiers</span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
            color: "var(--text-3)", fontSize: 12, padding: "3px 8px", cursor: "pointer",
            transition: "color 0.12s, border-color 0.12s",
          }}>×  close</button>
        </div>

        {/* Disclaimer */}
        <div style={{
          padding: "10px 18px",
          background: "rgba(216,138,58,0.06)",
          borderBottom: "1px solid rgba(216,138,58,0.2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--amber)",
          lineHeight: 1.55,
        }}>
          Best-effort de-identification for developer debugging. Not a certified HIPAA Safe Harbor tool. Do not use as a sole de-identification layer.
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                {["Category", "Identifier", "Strategy", "Notes"].map(h => (
                  <th key={h} style={{
                    fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--text-3)", textAlign: "left", padding: "8px 12px",
                    borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--surface)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HIPAA_18.map(([cat, id, strat, notes], i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "6px 12px" }}>
                    <span style={catChip(cat)}>{cat}</span>
                  </td>
                  <td style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)" }}>{id}</td>
                  <td style={{ padding: "6px 12px" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase",
                      padding: "2px 7px", borderRadius: 8,
                      color: strat === "remove" ? "#d9534f" : strat === "scrub" ? "var(--blue)" : "var(--accent)",
                      background: strat === "remove" ? "rgba(217,83,79,.12)" : strat === "scrub" ? "var(--blue-soft)" : "var(--accent-soft)",
                      border: `1px solid ${strat === "remove" ? "rgba(217,83,79,.3)" : strat === "scrub" ? "rgba(92,134,214,.3)" : "rgba(61,168,142,.3)"}`,
                    }}>{strat}</span>
                  </td>
                  <td style={{ padding: "6px 12px", fontSize: 11, color: "var(--text-3)", lineHeight: 1.45 }}>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--border)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-3)",
          letterSpacing: "0.04em",
        }}>
          DICOM scope: SR header tags only — no ContentSequence, no pixel data. OCR (Phase 6): HL7 v2 viewer screenshots.
        </div>
      </div>
    </div>
  );
}

// ── Instructional empty state ────────────────────────────────────────────

const FORMATS = [
  { id: "hl7v2",     label: "HL7 v2.x",    example: "MSH|^~\\&|…" },
  { id: "hl7v3",     label: "HL7 v3",       example: "<PRPA_IN201301UV02…" },
  { id: "cda",       label: "C-CDA",        example: "<ClinicalDocument…" },
  { id: "fhir-json", label: "FHIR JSON",    example: '{"resourceType":"Patient"…' },
  { id: "fhir-xml",  label: "FHIR XML",     example: "<Patient xmlns=…" },
];

function EmptyState({ density }) {
  const compact = density === "compact";
  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: compact ? "20px 32px" : "32px 40px",
      gap: compact ? 20 : 28,
      background: `radial-gradient(ellipse at 50% 60%, rgba(61,168,142,0.04) 0%, transparent 65%)`,
    }}>
      {/* Main instruction */}
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: compact ? 8 : 12,
        }}>paste-and-redact scratchpad</div>
        <div style={{
          fontSize: compact ? 14 : 16,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--text)",
          marginBottom: compact ? 6 : 8,
        }}>Paste a message to begin</div>
        <div style={{
          fontSize: compact ? 12 : 13,
          color: "var(--text-3)",
          lineHeight: 1.6,
        }}>
          Raw PHI is redacted before it ever appears. Content stays in memory — nothing is written to disk.
        </div>
      </div>

      {/* Keyboard shortcut */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          padding: "5px 12px", borderRadius: "var(--radius-sm)",
          background: "var(--surface)", border: "1px solid var(--border-2)",
          color: "var(--text-2)", letterSpacing: "0.04em",
        }}>Ctrl</span>
        <span style={{ color: "var(--text-3)", fontSize: 12 }}>+</span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          padding: "5px 12px", borderRadius: "var(--radius-sm)",
          background: "var(--surface)", border: "1px solid var(--border-2)",
          color: "var(--text-2)", letterSpacing: "0.04em",
        }}>V</span>
        <span style={{ color: "var(--text-3)", fontSize: 12, marginLeft: 4 }}>to paste and redact</span>
      </div>

      {/* Supported formats */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600,
          }}>Supported formats</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)",
            padding: "1px 7px", borderRadius: 8, background: "var(--accent-soft)",
            border: "1px solid rgba(61,168,142,.25)",
          }}>auto-detect</span>
        </div>
        {FORMATS.map((f, i) => (
          <div key={f.id} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: compact ? "6px 14px" : "8px 14px",
            borderBottom: i < FORMATS.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
              color: "var(--text-2)", minWidth: 82,
            }}>{f.label}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--text-3)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{f.example}</span>
          </div>
        ))}
      </div>

      {/* Phase note */}
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)",
        letterSpacing: "0.04em", opacity: 0.7,
      }}>
        Image paste (OCR) · Phase 6
      </div>
    </div>
  );
}

// ── Token tree ──────────────────────────────────────────────────────────

function TreeNodeRow({ node, depth, density }) {
  const compact = density === "compact";
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;
  const isRedacted = node.redaction != null;
  const py = compact ? 2 : 3;

  const pathStyle = {
    fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11,
    padding: "1px 6px", borderRadius: 3,
    background: node.kind === "segment" ? "var(--surface)" : isRedacted
      ? CAT_STYLE[node.redaction?.category]?.bg || "var(--surface-2)"
      : "var(--surface-2)",
    color: node.kind === "segment" ? "var(--text-2)" : isRedacted
      ? CAT_STYLE[node.redaction?.category]?.color || "var(--text-2)"
      : "var(--text-3)",
    border: `1px solid ${isRedacted ? CAT_STYLE[node.redaction?.category]?.border || "var(--border-2)" : "var(--border-2)"}`,
    flexShrink: 0,
    maxWidth: "20ch",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const row = (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      paddingLeft: 10 + depth * 14,
      paddingRight: 12,
      paddingTop: py,
      paddingBottom: py,
    }}>
      {hasChildren && (
        <span
          onClick={() => setOpen(!open)}
          style={{
            fontSize: 7, color: "var(--text-3)", cursor: "pointer",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.12s",
            display: "inline-block", width: 10, flexShrink: 0,
          }}>▶</span>
      )}
      {!hasChildren && <span style={{ width: 10, flexShrink: 0 }} />}
      <span style={pathStyle}>{node.path}</span>
      {!hasChildren && (
        <>
          {isRedacted && (
            <span style={catChip(node.redaction.category, 8)}>{node.redaction.category}</span>
          )}
          <span style={{
            flex: 1, minWidth: 0,
            fontFamily: "var(--font-mono)", fontSize: compact ? 11 : 12,
            color: node.value === null ? "var(--text-3)" : isRedacted ? "var(--text)" : "var(--text-2)",
            fontStyle: node.value === null ? "italic" : "normal",
            fontWeight: isRedacted ? 500 : 400,
            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {node.value === null ? (node.redaction?.rule.includes("remove") ? "[removed]" : "[scrubbed]") : node.value}
          </span>
        </>
      )}
      {hasChildren && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-2)", flex: 1 }}>{node.label}</span>
      )}
      {hasChildren && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", fontStyle: "italic" }}>
          ({node.children.length})
        </span>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ cursor: hasChildren ? "pointer" : "default" }}
        onClick={() => hasChildren && setOpen(!open)}
        onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface)"; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}>
        {row}
      </div>
      {hasChildren && open && (
        <div style={{ borderLeft: "1px solid var(--border)", marginLeft: 18 }}>
          {node.children.map((child, i) => (
            <TreeNodeRow key={i} node={child} depth={depth + 1} density={density} />
          ))}
        </div>
      )}
    </div>
  );
}

function TokenTree({ nodes, density }) {
  const compact = density === "compact";
  if (!nodes || nodes.length === 0) {
    return (
      <div style={{
        padding: 24, fontFamily: "var(--font-sans)", fontSize: 12,
        color: "var(--text-3)", fontStyle: "italic",
      }}>Paste content to see the tokenized tree.</div>
    );
  }
  return (
    <div style={{
      height: "100%", overflowY: "auto", overflowX: "hidden",
      fontFamily: "var(--font-mono)", fontSize: compact ? 11 : 12,
      paddingBottom: 16, paddingTop: 4,
    }}>
      {nodes.map((node, i) => (
        <TreeNodeRow key={i} node={node} depth={0} density={density} />
      ))}
    </div>
  );
}

// ── Findings panel ──────────────────────────────────────────────────────

function FindingsPanel({ findings, density }) {
  const [activeCats, setActiveCats] = useState(new Set());
  const compact = density === "compact";

  const presentCats = [...new Set(findings.map(f => f.category))].sort();
  const visible = activeCats.size === 0 ? findings : findings.filter(f => activeCats.has(f.category));

  const toggle = (cat) => {
    setActiveCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <aside style={{
      width: 288,
      minWidth: 240,
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "var(--bg-2)",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      // Subtle vertical stripe texture via gradient
      backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.012) 23px, rgba(255,255,255,0.012) 24px)",
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, padding: "0 14px",
        minHeight: compact ? 36 : 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, alignSelf: "stretch", background: "var(--blue)", display: "block", borderRadius: "0 2px 2px 0", marginLeft: -14, marginRight: 6 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--blue)", fontWeight: 600,
          }}>FINDINGS</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>
          {visible.length}{activeCats.size > 0 && ` / ${findings.length}`}
        </span>
      </div>

      {/* Category chips */}
      {presentCats.length > 0 && (
        <div style={{
          padding: "7px 10px",
          display: "flex", flexWrap: "wrap", gap: 3,
          borderBottom: "1px solid var(--border)",
          background: "rgba(22,27,46,0.5)",
        }}>
          {presentCats.map(cat => {
            const active = activeCats.has(cat);
            const s = CAT_STYLE[cat] || {};
            return (
              <button key={cat} onClick={() => toggle(cat)} style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: 10,
                border: `1px solid ${active ? s.border || "var(--border-2)" : "var(--border-2)"}`,
                color: active ? s.color || "var(--text-3)" : "var(--text-3)",
                background: active ? s.bg || "transparent" : "transparent",
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s, border-color 0.12s",
              }}>{cat}</button>
            );
          })}
        </div>
      )}

      {/* Findings list */}
      <ul style={{ flex: 1, overflowY: "auto", listStyle: "none", padding: compact ? "2px 0" : "4px 0" }}>
        {visible.length === 0 && findings.length === 0 && (
          <li style={{ padding: 14, fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
            No findings — paste some content.
          </li>
        )}
        {visible.length === 0 && findings.length > 0 && (
          <li style={{ padding: 14, fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>
            No findings match the active filter.
          </li>
        )}
        {visible.map((f, i) => {
          const s = CAT_STYLE[f.category] || {};
          return (
            <li key={i} style={{
              padding: compact ? "7px 14px" : "9px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              display: "flex", flexDirection: "column", gap: compact ? 2 : 3,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={catChip(f.category)}>{f.category}</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11,
                  color: "var(--text)", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                }}>{f.path}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{f.rule}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-3)", flexShrink: 0 }}>{f.strategy}</span>
              </div>
              {f.redactedValue !== null && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11,
                  color: "var(--text-2)",
                  paddingLeft: 10,
                  borderLeft: `2px solid ${s.border || "var(--border-2)"}`,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>→ {f.redactedValue}</div>
              )}
              {f.redactedValue === null && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11,
                  color: "var(--text-3)", fontStyle: "italic",
                  paddingLeft: 10, borderLeft: "2px solid var(--border-2)",
                }}>
                  {f.strategy === "remove" ? "[removed]" : "[scrubbed]"}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ── Format badge ─────────────────────────────────────────────────────────

function FormatBadge({ hasContent, format, confidence, forced }) {
  if (!hasContent) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--font-mono)", fontSize: 10,
      padding: "3px 9px", borderRadius: 4,
      border: `1px solid ${forced ? "rgba(92,134,214,.3)" : "rgba(61,168,142,.3)"}`,
      background: forced ? "var(--blue-soft)" : "var(--accent-soft)",
      color: forced ? "var(--blue)" : "var(--accent)",
    }}>
      <span style={{ fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>
        {forced ? "forced" : "detected"}
      </span>
      {format}
      {!forced && (
        <span style={{ color: "var(--text-3)", fontSize: 9 }}>{confidence}%</span>
      )}
    </span>
  );
}

// ── Status bar PHI badge ─────────────────────────────────────────────────

function PhiBadge({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click to view redaction policy"
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "3px 11px 3px 9px", borderRadius: 12,
        background: hover ? "rgba(61,168,142,0.2)" : "var(--accent-soft)",
        color: "var(--accent)",
        border: `1px solid ${hover ? "rgba(61,168,142,0.5)" : "rgba(61,168,142,0.32)"}`,
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
        letterSpacing: "0.06em", textTransform: "uppercase",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: "var(--accent)",
        boxShadow: "0 0 8px var(--accent), 0 0 16px rgba(61,168,142,0.5)",
        animation: "phiPulse 2.4s ease-in-out infinite",
        flexShrink: 0,
      }} />
      PHI mode: ON
      <span style={{ fontSize: 8, opacity: 0.6, marginLeft: 2, letterSpacing: 0 }}>↗</span>
    </button>
  );
}

// ── Mock editor pane ─────────────────────────────────────────────────────

const SAMPLE_HL7 = `MSH|^~\\&|EPIC|MSSM|GATEWAY|MSSM|20240112093021.874-0500||ADT^A01^ADT_A01|20240112093021874|P|2.5.1|||NE|AL|USA|ASCII|||
EVN|A01|20240112093021||||
PID|1||11234567^^^EPIC^MRN~987654321^^^NPI^PI||SMITH^JOHN^A^^MR||19680214|M|||123 MAPLE ST^^SPRINGFIELD^OH^45501^US||5555550192^^^PRN^PH|||M||11234567|123-45-6789|||
PV1|1|I|2000^2012^01^MSSM||||004777^DOE^JANE^J|004444^SMITH^FRED^P|||SUR|||ADM|A0|`;

const SAMPLE_REDACTED = `MSH|^~\\&|EPIC|MSSM|GATEWAY|MSSM|20240112093021.874-0500||ADT^A01^ADT_A01|20240112093021874|P|2.5.1|||NE|AL|USA|ASCII|||
EVN|A01|20240112093021||||
PID|1||MRN-00017742^^^EPIC^MRN~987654321^^^NPI^PI||SMITH^JOHN^A^^MR||19800101|M|||[scrubbed]||[removed]^^^PRN^PH|||M||MRN-00017742|[removed]|||
PV1|1|I|2000^2012^01^MSSM||||004777^JONES^MARY^J|004444^JONES^MARY^P|||SUR|||ADM|A0|`;

function MockEditorPane({ hasContent, density }) {
  const compact = density === "compact";
  const lineHeight = compact ? 17 : 19;
  const fontSize = compact ? 11 : 12;
  const lines = (hasContent ? SAMPLE_REDACTED : "").split("\n");

  if (!hasContent) {
    return <EmptyState density={density} />;
  }

  return (
    <div style={{
      height: "100%",
      overflowY: "auto",
      overflowX: "auto",
      background: "#0d1117",
      padding: "12px 0",
      fontFamily: "var(--font-mono)",
      fontSize,
      lineHeight: `${lineHeight}px`,
      color: "var(--text-2)",
    }}>
      {lines.map((line, i) => {
        const lineNum = i + 1;
        // Color segment names
        const isSegStart = /^[A-Z]{2,3}\|/.test(line);
        const segName = isSegStart ? line.split("|")[0] : null;
        const rest = isSegStart ? line.slice(segName.length) : null;

        return (
          <div key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            paddingRight: 20,
          }}>
            <span style={{
              minWidth: 36, paddingLeft: 14, paddingRight: 12,
              textAlign: "right", color: "var(--text-3)", userSelect: "none",
              fontSize: compact ? 10 : 11, opacity: 0.5,
            }}>{lineNum}</span>
            <span style={{ flex: 1, whiteSpace: "pre", wordBreak: "keep-all" }}>
              {isSegStart ? (
                <>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{segName}</span>
                  <span>{rest}</span>
                </>
              ) : line}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ScratchpadView ──────────────────────────────────────────────────

function ScratchpadView({ density }) {
  const [hasContent, setHasContent] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [formatChoice, setFormatChoice] = useState("auto");
  const [toast, setToast] = useState(null);
  const compact = density === "compact";

  const showToast = (kind, text) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2400);
  };

  const handlePaste = () => {
    if (!hasContent) {
      setHasContent(true);
      showToast("ok", `pasted · ${SAMPLE_FINDINGS.length} redactions`);
    }
  };

  const handleClear = () => {
    setHasContent(false);
    showToast("info", "cleared session");
  };

  const findings = hasContent ? SAMPLE_FINDINGS : [];
  const tree = hasContent ? SAMPLE_TREE : [];

  const headerH = compact ? 44 : 50;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {showPolicy && <PhiPolicyModal onClose={() => setShowPolicy(false)} />}

      {/* Header */}
      <header style={{
        height: headerH,
        flexShrink: 0,
        padding: "0 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-2)",
        position: "relative",
      }}>
        {/* Subtle teal highlight on bottom border */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(61,168,142,0.22), transparent)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: compact ? 14 : 15, fontWeight: 600, letterSpacing: "-0.02em" }}>Scratchpad</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)",
          }}>paste-and-redact</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Format selector */}
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)",
          }}>
            Format
            <select
              value={formatChoice}
              onChange={e => setFormatChoice(e.target.value)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                textTransform: "none", letterSpacing: 0,
                color: "var(--text)", background: "var(--surface)",
                border: "1px solid var(--border-2)", borderRadius: "var(--radius-sm)",
                padding: "3px 7px", cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="auto">Auto-detect</option>
              <option value="hl7v2">HL7 v2</option>
              <option value="hl7v3">HL7 v3</option>
              <option value="cda">C-CDA</option>
              <option value="fhir-json">FHIR JSON</option>
              <option value="fhir-xml">FHIR XML</option>
            </select>
          </label>

          {hasContent && (
            <FormatBadge hasContent={hasContent} format="hl7v2" confidence={98} forced={formatChoice !== "auto"} />
          )}

          {/* Copy / Clear group */}
          <div style={{
            display: "inline-flex", borderRadius: "var(--radius-sm)",
            overflow: "hidden", border: "1px solid var(--border-2)",
          }}>
            <button
              onClick={handlePaste}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                padding: compact ? "4px 10px" : "5px 12px",
                color: "var(--accent)", background: "var(--accent-soft)",
                borderRight: "1px solid var(--border-2)",
                cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(61,168,142,0.2)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--accent-soft)"}
            >{hasContent ? "Copy" : "Paste sample"}</button>
            <button
              onClick={handleClear}
              disabled={!hasContent}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                padding: compact ? "4px 10px" : "5px 12px",
                color: "var(--text-2)", background: "var(--surface)",
                cursor: hasContent ? "pointer" : "not-allowed",
                opacity: hasContent ? 1 : 0.45,
                transition: "color 0.12s, background 0.12s",
              }}
              onMouseOver={e => { if (hasContent) e.currentTarget.style.color = "var(--text)"; }}
              onMouseOut={e => { e.currentTarget.style.color = "var(--text-2)"; }}
            >Clear</button>
          </div>
        </div>
      </header>

      {/* Body: Paste | Tree | Findings */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0 }}>

        {/* Left column: panes stacked */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>

          {/* Paste pane */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border)" }}>
            <div style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 0,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-2)",
              minHeight: compact ? 28 : 32,
            }}>
              <span style={{
                alignSelf: "stretch", width: 3, flexShrink: 0,
                background: "var(--amber)",
                boxShadow: "0 0 10px rgba(216,138,58,0.4)",
              }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                fontWeight: 500, letterSpacing: "0.05em",
                textTransform: "uppercase", color: "var(--text)",
                paddingLeft: 12, flex: 1,
              }}>Paste</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--text-3)", fontStyle: "italic",
                letterSpacing: 0, textTransform: "none",
                paddingRight: 14,
              }}>screenshots in Phase 6</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <MockEditorPane hasContent={hasContent} density={density} />
            </div>
          </div>

          {/* Token tree pane */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 0,
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-2)",
              minHeight: compact ? 28 : 32,
            }}>
              <span style={{
                alignSelf: "stretch", width: 3, flexShrink: 0,
                background: "var(--accent)",
                boxShadow: "0 0 10px rgba(61,168,142,0.4)",
              }} />
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                fontWeight: 500, letterSpacing: "0.05em",
                textTransform: "uppercase", color: "var(--text)",
                paddingLeft: 12, flex: 1,
              }}>Tokenized values</span>
              {hasContent && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--text-3)", paddingRight: 14,
                }}>5 segments</span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TokenTree nodes={tree} density={density} />
            </div>
          </div>
        </div>

        {/* Findings panel */}
        <FindingsPanel findings={findings} density={density} />
      </div>

      {/* Status bar */}
      <footer style={{
        flexShrink: 0,
        height: compact ? 26 : 30,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-2)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--text-3)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(61,168,142,0.15), transparent)",
          pointerEvents: "none",
        }} />

        <PhiBadge onClick={() => setShowPolicy(true)} />

        {hasContent && (
          <span style={{ color: "var(--text-2)" }}>hl7v2 · 8 findings</span>
        )}

        {toast && (
          <span style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)", fontSize: 10,
            padding: "2px 9px", borderRadius: 4,
            animation: "toastFade 2.4s ease-out",
            ...(toast.kind === "ok"
              ? { color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(61,168,142,0.3)" }
              : toast.kind === "warn"
              ? { color: "var(--amber)", background: "rgba(216,138,58,0.12)", border: "1px solid rgba(216,138,58,0.3)" }
              : { color: "var(--blue)", background: "var(--blue-soft)", border: "1px solid rgba(92,134,214,0.3)" }
            ),
          }}>{toast.text}</span>
        )}
      </footer>
    </div>
  );
}

Object.assign(window, { ScratchpadView, PhiPolicyModal });
