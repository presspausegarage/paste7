// scratchpad-views.jsx — three direction components for paste7 design mockup
const { useState } = React;

// ── Shared: Sidebar rail ──────────────────────────────────────────────────

function Sidebar({ T, fontMono }) {
  return (
    <aside style={{ width: 52, flexShrink: 0, background: T.bg2, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${T.border}`, width: '100%', flexShrink: 0 }}>
        <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: '0.13em', textTransform: 'uppercase', color: T.accent, fontWeight: 600, writingMode: 'vertical-rl', transform: 'rotate(180deg)', userSelect: 'none' }}>p7</span>
      </div>
      <nav style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `2px solid ${T.accent}`, background: T.surface, color: T.accent }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="10" height="11" rx="1.5"/>
            <path d="M6 3V2a2 2 0 0 1 4 0v1"/>
            <path d="M5.5 7.5h5M5.5 10h3.5"/>
          </svg>
        </div>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '2px solid transparent', color: T.text3 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3a1 1 0 0 1 1-1h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3z"/>
            <path d="M9 2v3.5H12"/>
            <path d="M8 7.5v4M6 9.5h4"/>
          </svg>
        </div>
      </nav>
      <div style={{ paddingBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontFamily: fontMono, fontSize: 8, color: T.text3, letterSpacing: '0.04em', opacity: 0.7 }}>v0</span>
        <span style={{ fontFamily: fontMono, fontSize: 7, color: T.text3, border: `1px solid ${T.border}`, borderRadius: 3, padding: '1px 4px', opacity: 0.55 }}>AI</span>
      </div>
    </aside>
  );
}

// ── Header always dark (even in light mode) ───────────────────────────────
const HD = {
  bg: '#111524', surface: '#1c2340', border: '#242d4c', border2: '#2d3760',
  text: '#e5e9f4', text2: '#9aa5c3', text3: '#5e6884',
  accent: '#3da88e', accentSoft: 'rgba(61,168,142,0.14)', accentBorder: 'rgba(61,168,142,0.30)',
};

const FORMAT_OPTIONS = ['Auto-detect', 'HL7 v2', 'HL7 v3', 'C-CDA', 'FHIR JSON', 'FHIR XML'];

function FormatSelect({ fontMono }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('Auto-detect');
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ fontFamily: fontMono, fontSize: 11, color: HD.text2, background: HD.surface, border: `1px solid ${HD.border2}`, borderRadius: 5, padding: '4px 26px 4px 10px', cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap' }}
      >
        {value}
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: 'transform 0.15s', fontSize: 7, color: HD.text3, display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#161b2e', border: `1px solid ${HD.border2}`, borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', zIndex: 100, minWidth: 140 }}>
          {FORMAT_OPTIONS.map(opt => (
            <div key={opt} onClick={() => { setValue(opt); setOpen(false); }}
              style={{ fontFamily: fontMono, fontSize: 11, padding: '7px 14px', color: opt === value ? HD.accent : HD.text2, background: opt === value ? 'rgba(61,168,142,0.10)' : 'transparent', cursor: 'pointer', borderBottom: `1px solid rgba(255,255,255,0.04)` }}
              onMouseOver={e => { if (opt !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseOut={e => { e.currentTarget.style.background = opt === value ? 'rgba(61,168,142,0.10)' : 'transparent'; }}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared: App header ────────────────────────────────────────────────────

function AppHeader({ T, fontSans, fontMono }) {
  return (
    <header style={{ height: 50, flexShrink: 0, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${HD.border}`, background: HD.bg }}>
      <span style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: HD.text }}>Scratchpad</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: fontMono, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: HD.text3 }}>
          Format
          <FormatSelect fontMono={fontMono} />
        </label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: fontMono, fontSize: 10, padding: '3px 9px', borderRadius: 4, border: `1px solid ${HD.accentBorder}`, background: HD.accentSoft, color: HD.accent }}>
          <span style={{ fontSize: 8, opacity: 0.8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>detected</span>
          hl7v2
          <span style={{ fontSize: 9, color: HD.text3 }}>98%</span>
        </span>
        <div style={{ display: 'inline-flex', borderRadius: 5, overflow: 'hidden', border: `1px solid ${HD.border2}` }}>
          <button style={{ fontFamily: fontMono, fontSize: 10, padding: '5px 12px', color: '#fff', background: HD.accent, borderRight: `1px solid rgba(0,0,0,0.18)`, cursor: 'pointer', fontWeight: 600 }}>Copy</button>
          <button style={{ fontFamily: fontMono, fontSize: 10, padding: '5px 12px', color: HD.text2, background: HD.surface, cursor: 'pointer' }}>Clear</button>
        </div>
      </div>
    </header>
  );
}

// ── Shared: Mock editor ───────────────────────────────────────────────────

function EditorMock({ T, fontMono, fontSize = 12, lineH = 19 }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', background: T.editorBg, fontFamily: fontMono, fontSize, lineHeight: `${lineH}px`, paddingTop: 10, paddingBottom: 4 }}>
      {HL7_LINES.map((line, i) => {
        const sc = getSegClr(line.seg, T);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', paddingRight: 20, minWidth: 0 }}>
            <span style={{ minWidth: 36, paddingLeft: 12, paddingRight: 10, textAlign: 'right', color: T.text3, fontSize: fontSize - 1, opacity: 0.45, userSelect: 'none', lineHeight: `${lineH}px`, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, lineHeight: `${lineH}px` }}>
              <span style={{ color: sc.text, fontWeight: 600 }}>{line.seg}</span>
              <span style={{ color: T.text3 }}>|</span>
              <span style={{ color: T.text2 }}>{line.rest.slice(1)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared: Status bar ────────────────────────────────────────────────────

function StatusBar({ T, fontMono }) {
  return (
    <footer style={{ height: 28, flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${T.border}`, background: T.bg2, fontFamily: fontMono, fontSize: 10, color: T.text3 }}>
      <span title="View redaction policy" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '2px 10px 2px 8px', borderRadius: 10, background: T.accentSoft, color: T.accent, border: `1px solid ${T.accentBorder}`, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 9, cursor: 'pointer' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 5px ${T.accent}` }} />
        PHI mode: ON
        <span style={{ fontSize: 8, fontWeight: 400, letterSpacing: 0, textTransform: 'none', opacity: 0.75, marginLeft: 1 }}>· policy ↗</span>
      </span>
      <span style={{ color: T.text3 }}>hl7v2</span>
    </footer>
  );
}

// ── Shared: Tree view (badge renderer injected) ───────────────────────────

function TreeView({ T, fontSans, fontMono, SegBadge, rowH, showCatChip }) {
  // Separate: nodes with content to show vs empty collapsed ones
  const visible = TREE_NODES.filter(n => n.expanded && n.children?.length > 0);
  const hidden  = TREE_NODES.filter(n => !n.expanded || !n.children?.length);

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', fontFamily: fontMono }}>
      {visible.map((node, i) => {
        // Only show children that have a redaction — clean fields are noise in a PHI tool
        const phiChildren = node.children.filter(c => c.redaction !== null);
        const sc = getSegClr(node.path, T);
        if (!node.expanded || !node.children?.length) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 14, height: rowH, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 7, color: T.text3, width: 10, flexShrink: 0 }}>▶</span>
              <SegBadge seg={node.path} T={T} fontMono={fontMono} />
              <span style={{ fontFamily: fontSans, fontSize: 12, color: T.text2, flex: 1 }}>{node.label}</span>
            </div>
          );
        }
        return (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 14, height: rowH, background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 7, color: T.text3, width: 10, transform: 'rotate(90deg)', display: 'inline-block', flexShrink: 0 }}>▶</span>
              <SegBadge seg={node.path} T={T} fontMono={fontMono} />
              <span style={{ fontFamily: fontSans, fontSize: 12, color: T.text, fontWeight: 500, flex: 1 }}>{node.label}</span>
              <span style={{ fontSize: 10, color: T.text3, fontStyle: 'italic' }}>({phiChildren.length} PHI)</span>
            </div>
            {phiChildren.map((child, j) => {
              const cc = child.redaction ? getCatClr(child.redaction.category) : null;
              const isNull = child.value === null;
              return (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 32, paddingRight: 14, height: rowH, borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: fontMono, fontSize: 10, padding: '1px 6px', borderRadius: 3, background: cc ? cc.bg : T.surface2, color: cc ? cc.text : T.text3, border: `1px solid ${cc ? cc.border : T.border2}`, flexShrink: 0, maxWidth: '18ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.path}</span>
                  {showCatChip && cc && (
                    <span style={{ fontFamily: fontMono, fontSize: 8, padding: '1px 5px', borderRadius: 8, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{child.redaction.category}</span>
                  )}
                  <span style={{ fontFamily: fontMono, fontSize: 11, color: isNull ? T.text3 : cc ? T.text : T.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isNull ? 'italic' : 'normal', fontWeight: cc ? 500 : 400 }}>
                    {isNull ? (child.redaction?.rule?.includes('remove') || child.label === '[removed]' ? '[removed]' : '[scrubbed]') : child.value}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      {hidden.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 14, height: rowH, borderBottom: `1px solid ${T.border}` }}>
          <span style={{ width: 10, flexShrink: 0 }} />
          <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3, fontStyle: 'italic' }}>
            {hidden.length} segment{hidden.length !== 1 ? 's' : ''} with no findings —&nbsp;
          </span>
          <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hidden.map(n => n.path).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Direction A badge: filled pill, category-colored ─────────────────────

function SegBadgeFilled({ seg, T, fontMono }) {
  const sc = getSegClr(seg, T);
  return <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, flexShrink: 0 }}>{seg}</span>;
}

// ── Direction B badge: outlined pill, transparent fill ───────────────────

function SegBadgeOutlined({ seg, T, fontMono }) {
  const sc = getSegClr(seg, T);
  return <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'transparent', color: sc.text, border: `1.5px solid ${sc.border}`, flexShrink: 0 }}>{seg}</span>;
}

// ── Direction C badge: dot + name, no box ────────────────────────────────

function SegBadgeDot({ seg, T, fontMono }) {
  const sc = getSegClr(seg, T);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.text, flexShrink: 0, opacity: 0.85 }} />
      <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, color: sc.text }}>{seg}</span>
    </span>
  );
}

// ── Direction A findings: list with colored left border per item ──────────

function FindingsA({ T, fontSans, fontMono }) {
  return (
    <aside style={{ width: 272, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bg2, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.blue }}>Findings</span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3 }}>{FINDINGS.length}</span>
      </div>
      <div style={{ padding: '7px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {['name', 'id', 'date', 'address', 'phone'].map(cat => (
          <span key={cat} style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 10, border: `1px solid ${T.border2}`, color: T.text3, cursor: 'pointer' }}>{cat}</span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {FINDINGS.map((f, i) => {
          const cc = getCatClr(f.category);
          return (
            <div key={i} style={{ padding: '9px 14px 9px 11px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${cc.text}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 8, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`, flexShrink: 0 }}>{f.category}</span>
                <span style={{ fontFamily: fontMono, fontSize: 11, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.path}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: fontMono, fontSize: 9, color: T.text3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.rule}</span>
                <span style={{ fontFamily: fontMono, fontSize: 9, color: T.text3 }}>{f.strategy}</span>
              </div>
              {f.replacement ? (
                <div style={{ fontFamily: fontMono, fontSize: 10, color: T.text2, paddingLeft: 8, borderLeft: `2px solid ${T.border2}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {f.replacement}</div>
              ) : (
                <div style={{ fontFamily: fontMono, fontSize: 10, color: T.text3, fontStyle: 'italic', paddingLeft: 8, borderLeft: `2px solid ${T.border2}` }}>{f.strategy === 'remove' ? '[removed]' : '[scrubbed]'}</div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Direction B findings: grouped by category ────────────────────────────

function FindingsB({ T, fontSans, fontMono }) {
  const grouped = FINDINGS.reduce((acc, f) => { (acc[f.category] = acc[f.category] || []).push(f); return acc; }, {});
  return (
    <aside style={{ width: 292, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bg2, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <span style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.blue }}>Findings</span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text2 }}>{FINDINGS.length} total</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(grouped).map(([cat, items]) => {
          const cc = getCatClr(cat);
          return (
            <div key={cat}>
              <div style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, background: T.surface, borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc.text, flexShrink: 0 }} />
                <span style={{ fontFamily: fontMono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: cc.text, fontWeight: 600 }}>{cat}</span>
                <span style={{ fontFamily: fontMono, fontSize: 9, color: T.text3 }}>×{items.length}</span>
              </div>
              {items.map((f, i) => (
                <div key={i} style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: fontMono, fontSize: 11, color: T.text, fontWeight: 500 }}>{f.path}</span>
                    <span style={{ fontFamily: fontMono, fontSize: 9, color: T.text3, marginLeft: 'auto', flexShrink: 0 }}>{f.strategy}</span>
                  </div>
                  {f.replacement ? (
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text2 }}>→ {f.replacement}</span>
                  ) : (
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3, fontStyle: 'italic' }}>{f.strategy === 'remove' ? '[removed]' : '[scrubbed]'}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Direction C findings: card-style items ────────────────────────────────

function FindingsC({ T, fontSans, fontMono }) {
  return (
    <aside style={{ width: 284, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bg2, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: T.text }}>Findings</span>
        <span style={{ fontFamily: fontMono, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: T.blueSoft, color: T.blue, border: `1px solid ${T.blueBorder}` }}>{FINDINGS.length}</span>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        {['name', 'id', 'date', 'address', 'phone'].map(cat => (
          <span key={cat} style={{ fontFamily: fontMono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 10, border: `1px solid ${T.border2}`, color: T.text3, cursor: 'pointer' }}>{cat}</span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FINDINGS.map((f, i) => {
          const cc = getCatClr(f.category);
          return (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: fontMono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 8, background: cc.bg, color: cc.text, border: `1px solid ${cc.border}`, flexShrink: 0 }}>{f.category}</span>
                <span style={{ fontFamily: fontMono, fontSize: 11, color: T.text, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 10, color: f.replacement ? T.text2 : T.text3, fontStyle: f.replacement ? 'normal' : 'italic', paddingLeft: 2, borderLeft: `2px solid ${cc.border}`, paddingLeft: 8 }}>
                {f.replacement ? `→ ${f.replacement}` : f.strategy === 'remove' ? '[removed]' : '[scrubbed]'}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Direction A — "Calibrated": DM Sans + JetBrains Mono ─────────────────
// Refinement of current direction. No stripe on pane labels, filled category
// badges, findings panel revealed, more breathing room.

function DirA({ isDark }) {
  const T = isDark ? DARK : LIGHT;
  const fontSans = "'DM Sans', sans-serif";
  const fontMono = "'JetBrains Mono', monospace";
  return (
    <div style={{ width: 1280, height: 740, display: 'flex', background: T.bg, color: T.text, fontFamily: fontSans, fontSize: 13, lineHeight: '1.5', overflow: 'hidden' }}>
      <Sidebar T={T} fontMono={fontMono} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppHeader T={T} fontSans={fontSans} fontMono={fontMono} />
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Paste pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 500, color: T.text2, letterSpacing: '-0.01em' }}>Paste</span>
                <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3, fontStyle: 'italic' }}>text now · screenshots in Phase 6</span>
              </div>
              <EditorMock T={T} fontMono={fontMono} />
            </div>
            {/* Tree pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 500, color: T.text2, letterSpacing: '-0.01em' }}>Tokenized values</span>
                <span style={{ marginLeft: 'auto', fontFamily: fontMono, fontSize: 10, color: T.text3 }}>9 segments</span>
              </div>
              <TreeView T={T} fontSans={fontSans} fontMono={fontMono} SegBadge={SegBadgeFilled} rowH={26} showCatChip={true} />
            </div>
          </div>
          <FindingsA T={T} fontSans={fontSans} fontMono={fontMono} />
        </div>
        <StatusBar T={T} fontMono={fontMono} />
      </div>
    </div>
  );
}

// ── Direction B — "Layered": Outfit + JetBrains Mono ─────────────────────
// More structure. Icon-prefixed pane labels, outlined badges, findings
// grouped by PHI category.

function DirB({ isDark }) {
  const T = isDark ? DARK : LIGHT;
  const fontSans = "'Outfit', sans-serif";
  const fontMono = "'JetBrains Mono', monospace";
  return (
    <div style={{ width: 1280, height: 740, display: 'flex', background: T.bg, color: T.text, fontFamily: fontSans, fontSize: 13, lineHeight: '1.5', overflow: 'hidden' }}>
      <Sidebar T={T} fontMono={fontMono} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppHeader T={T} fontSans={fontSans} fontMono={fontMono} />
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Paste pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={T.text3} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M3 2.5h4.5L9 4v6.5a.5.5 0 01-.5.5h-5.5a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5z"/>
                  <path d="M7.5 2.5V4H9"/>
                  <path d="M4.5 6h4M4.5 7.5h3"/>
                </svg>
                <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 500, color: T.text2 }}>Paste</span>
              </div>
              <EditorMock T={T} fontMono={fontMono} />
            </div>
            {/* Tree pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke={T.text3} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="1" y="5.5" width="3" height="2" rx="0.5"/>
                  <rect x="9" y="2.5" width="3" height="2" rx="0.5"/>
                  <rect x="9" y="8.5" width="3" height="2" rx="0.5"/>
                  <path d="M4 6.5h2V3.5H9"/>
                  <path d="M6 6.5V9.5H9"/>
                </svg>
                <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 500, color: T.text2 }}>Tokens</span>
                <span style={{ marginLeft: 'auto', fontFamily: fontMono, fontSize: 10, color: T.text3 }}>1 segment with PHI · 5 clean</span>
              </div>
              <TreeView T={T} fontSans={fontSans} fontMono={fontMono} SegBadge={SegBadgeOutlined} rowH={28} showCatChip={false} />
            </div>
          </div>
        </div>
        <StatusBar T={T} fontMono={fontMono} />
      </div>
    </div>
  );
}

// ── Direction C — "Elevated": Plus Jakarta Sans + Fira Code ──────────────
// Maximum breathing room. Larger section headings, dot-indicator badges,
// card-style findings — most spacious, most premium feel.

function DirC({ isDark }) {
  const T = isDark ? DARK : LIGHT;
  const fontSans = "'Plus Jakarta Sans', sans-serif";
  const fontMono = "'Fira Code', monospace";
  return (
    <div style={{ width: 1280, height: 740, display: 'flex', background: T.bg, color: T.text, fontFamily: fontSans, fontSize: 13, lineHeight: '1.5', overflow: 'hidden' }}>
      <Sidebar T={T} fontMono={fontMono} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppHeader T={T} fontSans={fontSans} fontMono={fontMono} />
        <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Paste pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>Paste</span>
                <span style={{ fontFamily: fontMono, fontSize: 10, color: T.text3 }}>text now · screenshots in Phase 6</span>
              </div>
              <EditorMock T={T} fontMono={fontMono} fontSize={13} lineH={20} />
            </div>
            {/* Tree pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>Tokenized values</span>
                <span style={{ marginLeft: 'auto', fontFamily: fontMono, fontSize: 11, color: T.text2, fontWeight: 500 }}>9 segments</span>
              </div>
              <TreeView T={T} fontSans={fontSans} fontMono={fontMono} SegBadge={SegBadgeDot} rowH={30} showCatChip={true} />
            </div>
          </div>
          <FindingsC T={T} fontSans={fontSans} fontMono={fontMono} />
        </div>
        <StatusBar T={T} fontMono={fontMono} />
      </div>
    </div>
  );
}

Object.assign(window, { DirA, DirB, DirC });
