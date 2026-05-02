---
type: resource
category: design-reference
project: paste7
captured: 2026-05-01
tags:
  - type/resource
  - app/paste7
  - domain/design
---

# paste7 design reference — 2026-05-01

Mockup files generated in a separate Claude Design session (run was interrupted by credit cap; some pieces are incomplete). Source-of-truth for the post-runtime-verification visual pass on Phase 2 + Phase 3 surfaces.

## Files

| File | What it is |
|---|---|
| [colors_and_type.css](colors_and_type.css) | Design tokens: palette (muted teal `#3da88e` accent), type scale (`--fs-micro` to `--fs-2xl`), spacing scale, motion + letter-spacing tokens, `.caption`/`.eyebrow` utility classes. |
| [primitives.jsx](primitives.jsx) | `Caption`, `Pill`, `Tag`, `Input`, `Btn` — small React building blocks (window-attached for the design demo runtime; would translate to typed modules in our codebase). |
| [Sidebar.jsx](Sidebar.jsx) | 52px icon-rail sidebar with vertical "p7" wordmark and hover tooltips. Replaces the current 240px sidebar. |
| [ScratchpadView.jsx](ScratchpadView.jsx) | Scratchpad redesign — empty state with format-reference card + Ctrl+V keycaps; tree where path chip adopts the category color when the node is redacted; PHI Policy modal listing HIPAA Safe Harbor 18. |
| [DicomView.jsx](DicomView.jsx) | DICOM redesign matching the same patterns. |
| [tweaks-panel.jsx](tweaks-panel.jsx) | Design-playground iframe protocol harness — not product code; preserved for completeness. |

## Application phases

Tracked as commits against the paste7 repo. Each phase reveals more of the new look without leaving the app in a half-applied state.

1. **Tokens** — port `colors_and_type.css` into `packages/app/src/styles/app.css` design-token block.
2. **Sidebar** — 240px → 52px icon rail.
3. **Scratchpad polish** — empty state + path-chip color-on-redaction.
4. **PHI Policy modal** — header button → HIPAA 18 modal.
5. **DICOM polish** — mirror the Scratchpad updates.
6. **Typed primitives** — extract `Caption`, `Pill`, `Tag`, `Btn` modules once usage settles after 2–5.
