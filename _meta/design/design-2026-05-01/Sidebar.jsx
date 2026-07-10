// Sidebar.jsx — narrow 52px icon rail for paste7

const { useState } = React;

const NAV_ITEMS = [
  {
    id: "scratchpad",
    glyph: "⎘",
    label: "Scratchpad",
    sub: "Paste & redact",
  },
  {
    id: "dicom",
    glyph: "⌹",
    label: "DICOM SR",
    sub: "File drop",
  },
];

function SidebarRail({ active, onSelect }) {
  const [tooltip, setTooltip] = useState(null);

  return (
    <aside style={{
      width: 52,
      minWidth: 52,
      background: "var(--bg-2)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flexShrink: 0,
      zIndex: 10,
      position: "relative",
    }}>
      {/* Wordmark */}
      <div style={{
        height: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: "1px solid var(--border)",
        width: "100%",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontWeight: 600,
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          userSelect: "none",
        }}>p7</span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8, gap: 2, width: "100%" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setTooltip(item.id)}
              onMouseLeave={() => setTooltip(null)}
              title={item.label}
              style={{
                position: "relative",
                width: "100%",
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "var(--surface)" : "transparent",
                borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                borderRight: "none",
                borderTop: "none",
                borderBottom: "none",
                color: isActive ? "var(--accent)" : "var(--text-3)",
                fontSize: 18,
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s, border-color 0.12s",
                padding: 0,
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--surface)";
                  e.currentTarget.style.color = "var(--text-2)";
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-3)";
                }
              }}
            >
              <span style={{ lineHeight: 1, display: "block" }}>{item.glyph}</span>

              {/* Tooltip */}
              {tooltip === item.id && (
                <div style={{
                  position: "absolute",
                  left: "calc(100% + 10px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 10px",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "var(--shadow-popup)",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>{item.sub}</span>
                  {/* Arrow */}
                  <div style={{
                    position: "absolute",
                    left: -5,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 0,
                    height: 0,
                    borderTop: "5px solid transparent",
                    borderBottom: "5px solid transparent",
                    borderRight: "5px solid var(--border-2)",
                  }} />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer version badge */}
      <div style={{
        paddingBottom: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          color: "var(--text-3)",
          letterSpacing: "0.04em",
          opacity: 0.7,
        }}>v0</span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 7,
          color: "var(--text-3)",
          letterSpacing: "0.04em",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "1px 4px",
          opacity: 0.6,
        }}>AI</span>
      </div>
    </aside>
  );
}

Object.assign(window, { SidebarRail });
