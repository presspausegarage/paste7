// DicomView.jsx — paste7 DICOM SR redesign

const { useState: useDicomState } = React;

const SAMPLE_DICOM_FINDINGS = [
  { tag: "(0010,0010)", vr: "PN",  name: "Patient Name",            strategy: "substitute", category: "name",    redactedValue: "SMITH^JOHN^A" },
  { tag: "(0010,0020)", vr: "LO",  name: "Patient ID",              strategy: "substitute", category: "id",      redactedValue: "MRN-00017742" },
  { tag: "(0010,0030)", vr: "DA",  name: "Patient Birth Date",      strategy: "substitute", category: "date",    redactedValue: "19800101" },
  { tag: "(0010,1040)", vr: "LO",  name: "Patient's Other IDs",     strategy: "remove",     category: "id",      redactedValue: null },
  { tag: "(0008,0090)", vr: "PN",  name: "Referring Physician Name",strategy: "substitute", category: "name",    redactedValue: "JONES^MARY" },
  { tag: "(0008,1070)", vr: "PN",  name: "Operators' Name",         strategy: "substitute", category: "name",    redactedValue: "BROWN^ALEX" },
  { tag: "(0018,1000)", vr: "LO",  name: "Device Serial Number",    strategy: "substitute", category: "device-id", redactedValue: "SN-4829012" },
  { tag: "(0040,A124)", vr: "UI",  name: "UID",                     strategy: "substitute", category: "id",      redactedValue: "2.25.192743900291234" },
];

const CAT_STYLE_D = {
  name:      { color: "var(--blue)",   bg: "var(--blue-soft)",       border: "rgba(92,134,214,0.3)" },
  id:        { color: "var(--blue)",   bg: "var(--blue-soft)",       border: "rgba(92,134,214,0.3)" },
  date:      { color: "var(--amber)",  bg: "rgba(216,138,58,.12)",   border: "rgba(216,138,58,.3)" },
  address:   { color: "var(--amber)",  bg: "rgba(216,138,58,.12)",   border: "rgba(216,138,58,.3)" },
  phone:     { color: "var(--accent)", bg: "var(--accent-soft)",     border: "rgba(61,168,142,.3)" },
  "device-id":{ color: "var(--accent)", bg: "var(--accent-soft)",    border: "rgba(61,168,142,.3)" },
  biometric: { color: "#d9534f",       bg: "rgba(217,83,79,.12)",    border: "rgba(217,83,79,.3)" },
  photo:     { color: "#d9534f",       bg: "rgba(217,83,79,.12)",    border: "rgba(217,83,79,.3)" },
};

function chip(cat, size = 9) {
  const s = CAT_STYLE_D[cat] || { color: "var(--text-3)", bg: "var(--surface-2)", border: "var(--border-2)" };
  return {
    display: "inline-block",
    fontFamily: "var(--font-mono)", fontSize: size,
    letterSpacing: "0.04em", textTransform: "uppercase",
    padding: "2px 6px", borderRadius: 8,
    color: s.color, background: s.bg, border: `1px solid ${s.border}`,
  };
}

function stratChip(strat) {
  const map = {
    substitute: { color: "var(--accent)", bg: "var(--accent-soft)", border: "rgba(61,168,142,.3)" },
    scrub:      { color: "var(--blue)",   bg: "var(--blue-soft)",   border: "rgba(92,134,214,.3)" },
    remove:     { color: "#d9534f",       bg: "rgba(217,83,79,.12)", border: "rgba(217,83,79,.3)" },
  };
  const s = map[strat] || map.scrub;
  return {
    display: "inline-block",
    fontFamily: "var(--font-mono)", fontSize: 9,
    letterSpacing: "0.04em", textTransform: "uppercase",
    padding: "2px 6px", borderRadius: 8,
    color: s.color, background: s.bg, border: `1px solid ${s.border}`,
  };
}

function DicomView({ density }) {
  const [loaded, setLoaded] = useDicomState(false);
  const [dragOver, setDragOver] = useDicomState(false);
  const [retain, setRetain] = useDicomState({ dates: false, uids: false, deviceIds: false });
  const [exportDone, setExportDone] = useDicomState(false);
  const compact = density === "compact";

  const handleLoad = () => { setLoaded(true); setExportDone(false); };
  const handleClear = () => { setLoaded(false); setExportDone(false); };
  const handleExport = () => setExportDone(true);

  const headerH = compact ? 44 : 50;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>

      {/* Header */}
      <header style={{
        height: headerH, flexShrink: 0,
        padding: "0 18px",
        display: "flex", alignItems: "center", gap: 14,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-2)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(61,168,142,0.18), transparent)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: compact ? 14 : 15, fontWeight: 600, letterSpacing: "-0.02em" }}>DICOM SR</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)",
          }}>structured report</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!loaded && (
            <button onClick={handleLoad} style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              padding: compact ? "4px 12px" : "5px 14px",
              color: "var(--accent)", background: "var(--accent-soft)",
              border: "1px solid rgba(61,168,142,0.3)", borderRadius: "var(--radius-sm)",
              cursor: "pointer", transition: "background 0.12s",
            }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(61,168,142,0.2)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--accent-soft)"}
            >Open .dcm…</button>
          )}
          {loaded && (
            <>
              <button onClick={handleExport} style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                padding: compact ? "4px 12px" : "5px 14px",
                color: "var(--accent)", background: "var(--accent-soft)",
                border: "1px solid rgba(61,168,142,0.3)", borderRadius: "var(--radius-sm)",
                cursor: "pointer", transition: "background 0.12s",
              }}>Export redacted</button>
              <button onClick={handleClear} style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                padding: compact ? "4px 12px" : "5px 14px",
                color: "var(--text-3)", background: "transparent",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                cursor: "pointer", transition: "color 0.12s, border-color 0.12s",
              }}>Clear</button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: loaded ? "18px 22px 32px" : 0 }}>
        {!loaded ? (
          /* Minimal drop zone — just a centered prompt */
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleLoad(); }}
            style={{
              height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 16,
              background: dragOver ? "var(--accent-soft)" : "transparent",
              transition: "background 0.12s",
            }}
          >
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--text-3)", textAlign: "center",
            }}>
              Drop a .dcm file here, or
            </div>
            <button onClick={handleLoad} style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              padding: "8px 20px",
              color: "var(--accent)", background: "var(--accent-soft)",
              border: "1px solid rgba(61,168,142,0.3)", borderRadius: "var(--radius-sm)",
              cursor: "pointer", transition: "background 0.12s",
            }}>Open .dcm file…</button>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--text-3)", textAlign: "center",
              lineHeight: 1.6, maxWidth: 340,
            }}>
              SR headers only — non-SR DICOM rejected. Pixel data and<br/>ContentSequence preserved verbatim. In-memory only.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* File summary card */}
            <section style={{
              display: "grid", gridTemplateColumns: "120px 1fr",
              gap: "5px 14px", padding: compact ? "12px 14px" : "14px 16px",
              background: "var(--bg-2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}>
              {[
                ["Source", "chest-sr-20240112.dcm"],
                ["SOP Class", "Enhanced SR Storage"],
                ["SOP Class UID", "1.2.840.10008.5.1.4.1.1.88.22"],
                ["Redactions", `${SAMPLE_DICOM_FINDINGS.length}`],
              ].map(([label, value]) => (
                <React.Fragment key={label}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--text-3)", alignSelf: "center",
                  }}>{label}</span>
                  <span style={{ fontSize: compact ? 12 : 13, color: "var(--text)" }}>{value}</span>
                </React.Fragment>
              ))}
              {exportDone && (
                <React.Fragment>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--accent)", alignSelf: "center",
                  }}>Last export</span>
                  <span style={{ fontSize: 12, color: "var(--accent)" }}>chest-sr-20240112.redacted.dcm</span>
                </React.Fragment>
              )}
            </section>

            {/* Retain toggles */}
            <section style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: compact ? "8px 14px" : "10px 16px",
              background: "var(--bg-2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", flexWrap: "wrap",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--text-3)", marginRight: 4,
              }}>PS 3.15 retain</span>
              {[
                { key: "dates", label: "Dates" },
                { key: "uids", label: "UIDs" },
                { key: "deviceIds", label: "Device identity" },
              ].map(({ key, label }) => {
                const on = retain[key];
                return (
                  <label key={key} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "var(--font-mono)", fontSize: 10, color: on ? "var(--accent)" : "var(--text-2)",
                    padding: "3px 10px", borderRadius: 10,
                    border: `1px solid ${on ? "rgba(61,168,142,.3)" : "var(--border-2)"}`,
                    background: on ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                    transition: "color 0.12s, border-color 0.12s, background 0.12s",
                  }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={e => setRetain(r => ({ ...r, [key]: e.target.checked }))}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {label}
                  </label>
                );
              })}
            </section>

            {/* Findings table */}
            <section style={{
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              background: "var(--bg-2)", overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 11 : 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    {["Tag", "VR", "Name", "Action", "Replacement"].map(h => (
                      <th key={h} style={{
                        fontFamily: "var(--font-mono)", fontSize: 9,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: "var(--text-3)", textAlign: "left",
                        padding: compact ? "6px 10px" : "8px 12px",
                        borderBottom: "1px solid var(--border)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_DICOM_FINDINGS.map((f, i) => (
                    <tr key={i}
                      onMouseOver={e => e.currentTarget.style.background = "var(--surface)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.025)", transition: "background 0.1s" }}
                    >
                      <td style={{ padding: compact ? "5px 10px" : "7px 12px", fontFamily: "var(--font-mono)", color: "var(--text)", whiteSpace: "nowrap" }}>{f.tag}</td>
                      <td style={{ padding: compact ? "5px 10px" : "7px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)" }}>{f.vr}</td>
                      <td style={{ padding: compact ? "5px 10px" : "7px 12px", color: "var(--text-2)" }}>{f.name}</td>
                      <td style={{ padding: compact ? "5px 10px" : "7px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={stratChip(f.strategy)}>{f.strategy}</span>
                          <span style={chip(f.category)}>{f.category}</span>
                        </div>
                      </td>
                      <td style={{ padding: compact ? "5px 10px" : "7px 12px", fontFamily: "var(--font-mono)", fontSize: compact ? 10 : 11, color: "var(--text-2)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.redactedValue === null
                          ? <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>[removed]</span>
                          : f.redactedValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>

      {/* Status bar */}
      <footer style={{
        flexShrink: 0,
        height: compact ? 26 : 30,
        padding: "0 14px",
        display: "flex", alignItems: "center", gap: 14,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-2)",
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-3)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(61,168,142,0.15), transparent)",
          pointerEvents: "none",
        }} />
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "3px 11px 3px 9px", borderRadius: 12,
          background: "var(--accent-soft)", color: "var(--accent)",
          border: "1px solid rgba(61,168,142,0.32)",
          fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent)",
            animation: "phiPulse 2.4s ease-in-out infinite",
            flexShrink: 0,
          }} />
          PHI mode: ON
        </span>
        {loaded && (
          <span style={{ color: "var(--text-2)" }}>
            Enhanced SR Storage · {SAMPLE_DICOM_FINDINGS.length} redactions
          </span>
        )}
        {exportDone && (
          <span style={{ color: "var(--accent)", marginLeft: "auto" }}>
            wrote chest-sr-20240112.redacted.dcm
          </span>
        )}
      </footer>
    </div>
  );
}

Object.assign(window, { DicomView });
