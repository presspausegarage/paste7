// primitives.jsx — shared building blocks for the Health Integrate kit.
// Each one maps 1:1 to a class in the real app's CSS.

const { useState } = React;

function Caption({ tone, children, style }) {
  const colorMap = {
    accent: 'var(--accent)',
    blue:   'var(--blue)',
    amber:  'var(--amber)',
  };
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: colorMap[tone] || 'var(--text-3)',
      fontWeight: 600,
      ...style,
    }}>{children}</span>
  );
}

function Pill({ children, style, onClose }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '3px 10px',
      fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)',
      ...style,
    }}>
      {children}
      {onClose && <button onClick={onClose} style={{
        background: 'none', border: 'none', color: 'var(--text-3)',
        fontSize: 12, lineHeight: 1, cursor: 'pointer', padding: 0,
      }}>×</button>}
    </span>
  );
}

function Tag({ variant = 'id', children }) {
  const styles = {
    group:  { color: 'var(--blue)',   borderColor: 'rgba(78,142,247,0.22)',  background: 'var(--blue-soft)' },
    fields: { color: 'var(--accent)', borderColor: 'rgba(0,200,160,0.22)',   background: 'var(--accent-soft)' },
    lint:   { color: 'var(--amber)',  borderColor: 'rgba(245,166,35,0.30)',  background: 'rgba(245,166,35,0.10)' },
    id:     { color: 'var(--text-3)', borderColor: 'var(--border)',          background: 'var(--surface)' },
  };
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9,
      padding: '2px 7px', borderRadius: 3, border: '1px solid',
      ...styles[variant],
    }}>{children}</span>
  );
}

function Input({ value, onChange, placeholder, style, dirty }) {
  const [focused, setFocused] = useState(false);
  const base = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 5, color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: 11,
    padding: '6px 10px', outline: 'none', width: '100%',
    transition: 'border-color 0.12s, background 0.12s, color 0.12s',
  };
  const focus = focused ? { borderColor: 'var(--blue)', background: 'var(--blue-soft)' } : {};
  const dirt  = dirty   ? { color: 'var(--amber)', borderColor: 'rgba(245,166,35,0.3)' } : {};
  return (
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...base, ...focus, ...dirt, ...style }}
    />
  );
}

function Btn({ variant, children, onClick, style }) {
  const [hover, setHover] = useState(false);
  let base = {
    fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
    padding: '6px 12px', borderRadius: 5, border: '1px solid var(--border)',
    color: 'var(--text-2)', background: 'var(--surface)',
    transition: 'border-color 0.12s, color 0.12s, background 0.12s',
    whiteSpace: 'nowrap', cursor: 'pointer',
  };
  if (variant === 'primary') base = { ...base,
    background: 'var(--accent)', borderColor: 'var(--accent)',
    color: 'var(--bg)', fontWeight: 600,
  };
  if (variant === 'subtle') base = { ...base,
    background: 'transparent', borderColor: 'transparent',
    color: 'var(--text-3)', padding: '4px 8px',
  };
  let hov = {};
  if (hover) {
    if (variant === 'primary') hov = { background: 'var(--accent-hover)', borderColor: 'var(--accent-hover)' };
    else if (variant === 'subtle') hov = { color: 'var(--text-2)', background: 'var(--surface)', borderColor: 'var(--border)' };
    else hov = { borderColor: 'var(--accent)', color: 'var(--text)' };
  }
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...hov, ...style }}
    >{children}</button>
  );
}

Object.assign(window, { Caption, Pill, Tag, Input, Btn });
