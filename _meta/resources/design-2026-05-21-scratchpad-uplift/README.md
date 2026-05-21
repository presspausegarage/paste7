# Handoff: Scratchpad UI Uplift (Direction B)

## Overview

This is a design uplift for the `ScratchpadView` in paste7. The goal is to make the UI feel polished and intentional — better visual hierarchy, clearer PHI signal, and a cleaner pane structure. The chosen direction is **"B — Layered"**: Outfit + JetBrains Mono, outlined segment badges, SVG icons, and a simplified layout that removes the findings panel in favour of a focused token tree.

## About the Design Files

The files in this bundle are **HTML design prototypes** — they show intended look, feel, and interaction, but are not production code to be shipped. Your task is to **recreate these designs in the paste7 React/TypeScript codebase** using its existing patterns and libraries. Reference the HTML files visually and for exact values (colours, spacing, type); do not copy them directly.

- `Scratchpad Demo.html` — interactive demo showing the full flow (intro → empty state → paste simulation → token tree reveal + PHI policy modal). **This is the primary reference.**
- `Scratchpad Redesign.html` — design canvas comparing all three directions. Open it to compare A, B, C side-by-side.
- `scratchpad-views.jsx` — React component source for all three directions. `DirB` is the chosen one.
- `scratchpad-data.jsx` — design tokens (DARK/LIGHT), colour helpers, sample data.

## Fidelity

**High-fidelity.** Pixel-precise colours, typography, spacing, and interactions. Recreate the UI to match the demo exactly. All exact values are documented below.

---

## Files to Change

| File | Change scope |
|---|---|
| `packages/app/src/styles/app.css` | Font imports, token updates, button + pane label + badge class rewrites |
| `packages/app/src/shared/Sidebar.tsx` | Replace Unicode glyphs with inline SVGs |
| `packages/app/src/scratchpad/ScratchpadView.tsx` | Header cleanup, FormatSelect dropdown, status bar |
| `packages/app/src/scratchpad/TokenTreeView.tsx` | Filter logic, row height, badge style, footer row |
| `packages/app/src/scratchpad/FindingsPanel.tsx` | Remove from layout (hide or delete import) |

---

## Design Tokens

These live in `packages/app/src/styles/app.css` under `:root`. **No token values change** — only usage changes. For reference:

```css
--font-sans:   "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono:   "JetBrains Mono", Consolas, "IBM Plex Mono", Menlo, monospace;

/* Surfaces */
--bg:         #0b0e18;
--bg-2:       #111524;
--surface:    #161b2e;
--surface-2:  #1c2340;
--border:     #242d4c;
--border-2:   #2d3760;

/* Text */
--text:   #e5e9f4;
--text-2: #9aa5c3;
--text-3: #5e6884;

/* Accents */
--accent:      #3da88e;
--accent-soft: rgba(61,168,142,0.14);
--blue:        #5c86d6;
--blue-soft:   rgba(92,134,214,0.14);
--amber:       #d88a3a;
--amber-soft:  rgba(216,138,58,0.10);
```

### Font change

Update `--font-sans` from `"DM Sans"` → `"Outfit"`. Add the Google Fonts import at the top of `app.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

Or install via npm: `npm install @fontsource/outfit @fontsource/jetbrains-mono` and import in `main.tsx`.

---

## 1. Header (`ScratchpadView.tsx`)

### What changes
- Remove the `<span className="scratchpad-subtitle">paste-and-redact</span>` subtitle entirely
- Replace the native `<select className="format-select">` with a custom `FormatSelect` component
- Copy button: change from teal-soft bg + teal text → **solid teal bg + white text**
- Header background: always use `--bg-2` hardcoded dark value (`#111524`) — do **not** change this for light mode

### FormatSelect component

Add this new component to `ScratchpadView.tsx` (or a separate `FormatSelect.tsx`):

```tsx
import { useState } from "react";

const FORMAT_OPTIONS = ["Auto-detect", "HL7 v2", "HL7 v3", "C-CDA", "FHIR JSON", "FHIR XML"] as const;

function FormatSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="format-select-btn"
      >
        {value}
        <span className={`format-select-chevron ${open ? "is-open" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="format-select-dropdown">
          {FORMAT_OPTIONS.map(opt => (
            <div
              key={opt}
              className={`format-select-option ${opt === value ? "is-active" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### CSS for FormatSelect (add to `app.css`)

```css
.format-select-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: 5px;
  padding: 4px 26px 4px 10px;
  cursor: pointer;
  position: relative;
  white-space: nowrap;
}

.format-select-chevron {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%) rotate(0deg);
  transition: transform 0.15s;
  font-size: 7px;
  color: var(--text-3);
  display: inline-block;
}

.format-select-chevron.is-open {
  transform: translateY(-50%) rotate(180deg);
}

.format-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--surface);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(0,0,0,0.55);
  z-index: 100;
  min-width: 140px;
}

.format-select-option {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 7px 14px;
  color: var(--text-2);
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.1s;
}

.format-select-option:hover { background: rgba(255,255,255,0.05); }
.format-select-option.is-active { color: var(--accent); background: rgba(61,168,142,0.10); }
```

### Copy/Clear button fix (in `app.css`)

```css
/* Was: teal text on teal-soft bg. Now: white text on solid teal */
.copy-btn-primary {
  background: var(--accent);
  color: #ffffff;
  font-weight: 600;
  border-right: 1px solid rgba(0,0,0,0.18);
}

.copy-btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
```

---

## 2. Sidebar (`Sidebar.tsx`)

Replace the Unicode glyph icons with inline SVGs. Find the two `sidebar-item-glyph` spans and replace:

### Scratchpad icon (was `⎘`)
```tsx
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
  <rect x="3" y="3" width="10" height="11" rx="1.5"/>
  <path d="M6 3V2a2 2 0 014 0v1"/>
  <path d="M5.5 7.5h5M5.5 10h3.5"/>
</svg>
```

### DICOM icon (was `⌹`)
```tsx
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
  <path d="M3 3a1 1 0 011-1h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3z"/>
  <path d="M9 2v3.5H12"/>
  <path d="M8 7.5v4M6 9.5h4"/>
</svg>
```

Remove `font-size: 18px` from `.sidebar-item-glyph` in `app.css` — the SVGs size themselves.

---

## 3. Pane labels (`ScratchpadView.tsx` + `app.css`)

### What changes
- Remove the colored left stripe (`.pane-label-stripe`)
- Replace mono-uppercase label text with Outfit 12px medium
- Add an SVG icon prefix
- Change label copy: "PASTE" → "Paste" · "TOKENIZED VALUES" → "Tokens"
- Tokens pane meta: compute `"{phiSegmentCount} segment{s} with PHI · {cleanCount} clean"` instead of hardcoded segment count

### Updated CSS for `.scratchpad-pane-label`

```css
.scratchpad-pane-label {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 14px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  min-height: 34px;
}

/* Remove .pane-label-stripe entirely */

.pane-label-text {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  text-transform: none;
  letter-spacing: -0.01em;
}

.pane-label-hint {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  font-style: italic;
}

.pane-label-meta {
  margin-left: auto;
  margin-right: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
}
```

### Paste pane label SVG icon (add before `.pane-label-text`)
```tsx
<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
  <path d="M3 2.5h4.5L9 4v6.5a.5.5 0 01-.5.5h-5.5a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5z"/>
  <path d="M7.5 2.5V4H9"/>
  <path d="M4.5 6h4M4.5 7.5h3"/>
</svg>
```

### Tokens pane label SVG icon
```tsx
<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
  <rect x="1" y="5.5" width="3" height="2" rx="0.5"/>
  <rect x="9" y="2.5" width="3" height="2" rx="0.5"/>
  <rect x="9" y="8.5" width="3" height="2" rx="0.5"/>
  <path d="M4 6.5h2V3.5H9"/>
  <path d="M6 6.5V9.5H9"/>
</svg>
```

Remove the "text now · screenshots in Phase 6" hint text from the Paste pane label when Phase 6 ships.

---

## 4. Token tree (`TokenTreeView.tsx`)

### Filter logic

**Only show segments that have PHI findings.** Segments with no redacted children should be hidden from the main tree and summarised in a footer row.

```tsx
// In TokenTreeView, split nodes:
const visibleNodes = tree.nodes.filter(node =>
  node.children?.some(c => c.redaction !== undefined)
);
const hiddenNodes = tree.nodes.filter(node =>
  !node.children?.some(c => c.redaction !== undefined)
);

// Within each visible node, only show redacted children:
const phiChildren = node.children.filter(c => c.redaction !== undefined);
```

### Row height

Increase from `~24px` to `28px`. In `.tree-row-leaf` and `.tree-row-branch > .tree-row-summary`:
```css
.tree-row-leaf,
.tree-row-branch > .tree-row-summary {
  min-height: 28px;
  padding-top: 4px;
  padding-bottom: 4px;
}
```

### Segment badges — outlined style

Replace the filled badge style with outlined (transparent bg, coloured border + text):

```css
.tree-path {
  /* ... existing ... */
  background: transparent;          /* was: var(--surface-2) */
  border-width: 1.5px;              /* slightly thicker for outlined look */
}

/* Filled categories become outlined: */
.tree-path-cat-name, .tree-path-cat-id {
  background: transparent;
  color: var(--blue);
  border-color: rgba(92,134,214,0.35);
}
.tree-path-cat-address, .tree-path-cat-geo, .tree-path-cat-date {
  background: transparent;
  color: var(--amber);
  border-color: rgba(216,138,58,0.35);
}
.tree-path-cat-phone, .tree-path-cat-email, .tree-path-cat-url {
  background: transparent;
  color: var(--accent);
  border-color: rgba(61,168,142,0.35);
}
```

### Branch child count label

Change from `(5)` → `(4 PHI)` where 4 is the count of redacted children only:

```tsx
// In the branch summary line:
<span className="tree-childcount">{phiChildren.length} PHI</span>
```

Update `.tree-childcount` CSS — remove the `()` pseudo-content and render it inline:
```css
.tree-childcount::before { content: "("; }
.tree-childcount::after  { content: ")"; }
```

### Footer row for hidden segments

After rendering visible nodes, add a summary row:

```tsx
{hiddenNodes.length > 0 && (
  <div className="tree-row-hidden-summary">
    <span className="tree-hidden-label">
      {hiddenNodes.length} segment{hiddenNodes.length !== 1 ? "s" : ""} with no findings —
    </span>
    <span className="tree-hidden-paths">
      {hiddenNodes.map(n => n.path).join(", ")}
    </span>
  </div>
)}
```

```css
.tree-row-hidden-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px 0 32px;
  height: 28px;
  border-bottom: 1px solid var(--border);
}

.tree-hidden-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  font-style: italic;
  flex-shrink: 0;
}

.tree-hidden-paths {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## 5. Status bar (`ScratchpadView.tsx`)

### What changes
- Remove `"{format} · {findings.length} finding{s}"` detail text
- Remove the toast notification span
- Merge the `Policy` button into the `.phi-badge` as a click target (badge already opens the PHI Policy modal — just extend `onClick` to `() => setShowPolicy(true)` on the badge)
- Add `· policy ↗` suffix to badge text

### Updated badge markup
```tsx
<button
  type="button"
  className="phi-badge"
  onClick={() => setShowPolicy(true)}
  title="View PHI redaction policy"
>
  <span className="phi-dot" />
  PHI mode: ON
  <span className="phi-badge-policy">· policy ↗</span>
</button>
```

```css
.phi-badge {
  /* existing styles … */
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}

.phi-badge:hover {
  background: rgba(61,168,142,0.22);
  border-color: rgba(61,168,142,0.5);
}

.phi-badge-policy {
  font-size: 8px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  opacity: 0.75;
  margin-left: 2px;
}
```

Remove the standalone `.phi-policy-trigger` button from the header toolbar entirely.

---

## 6. Findings panel

Remove `<FindingsPanel />` from `ScratchpadView.tsx`. You can either:
- Delete the import and JSX usage (cleanest)
- Or hide it via `display: none` as a reversible change

The `FindingsPanel.tsx` file itself can be kept for now in case the feature is re-introduced.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| Format dropdown open | Opens below the button, `z-index: 100`, closes on option select |
| Format dropdown option hover | `rgba(255,255,255,0.05)` background |
| Active format option | `var(--accent)` text + `rgba(61,168,142,0.10)` background |
| Copy button hover | `var(--accent-hover)` background |
| Clear button hover | `var(--text)` colour, `var(--surface-2)` background |
| PHI badge click | Opens PHI Policy modal (existing `PhiPolicyModal` component) |
| Tree row hover | `var(--surface)` background |
| Tree branch toggle | Existing collapse/expand behaviour unchanged |

---

## Light Mode Notes

The **header** (`scratchpad-header`, `dicom-header`) should remain dark in light mode. Apply a data-attribute or class-based override:

```css
/* In light mode, keep the header dark */
[data-color-scheme="light"] .scratchpad-header,
[data-color-scheme="light"] .dicom-header {
  background: #111524;
  border-bottom-color: #242d4c;
}
```

The editor background in light mode should be `#ffffff` (not the dark `#0d1117`). Update Monaco's theme to `"vs"` (light) when in light mode, and `"vs-dark"` when dark:

```tsx
theme={colorScheme === "dark" ? "vs-dark" : "vs"}
```

---

## Assets

No image assets. All icons are inline SVGs documented above. Fonts are loaded from Google Fonts or can be installed via npm.

---

## Files in This Bundle

| File | Purpose |
|---|---|
| `README.md` | This document |
| `Scratchpad Demo.html` | **Primary reference** — interactive demo of the full flow |
| `Scratchpad Redesign.html` | Design canvas comparing all three directions |
| `scratchpad-views.jsx` | React source for all three directions (`DirB` is chosen) |
| `scratchpad-data.jsx` | Design tokens, colour helpers, sample data |

Open `Scratchpad Demo.html` in a browser to walk through: intro → empty state → paste simulation → token tree reveal → PHI policy modal.
