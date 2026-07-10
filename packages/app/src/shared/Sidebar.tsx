import { useState } from "react";
import { WORKFLOWS } from "./workflows.js";
import type { WorkflowId, WorkflowMeta } from "./workflows.js";

interface Props {
  active: WorkflowId;
  onSelect: (id: WorkflowId) => void;
}

// Inline SVG icons per workflow. `stroke="currentColor"` so the icon picks up
// the sidebar item's color states (text-3 idle, text-2 hover, accent active).
const ICONS: Record<WorkflowId, JSX.Element> = {
  scratchpad: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="10" height="11" rx="1.5" />
      <path d="M6 3V2a2 2 0 014 0v1" />
      <path d="M5.5 7.5h5M5.5 10h3.5" />
    </svg>
  ),
  dicom: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3a1 1 0 011-1h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" />
      <path d="M9 2v3.5H12" />
      <path d="M8 7.5v4M6 9.5h4" />
    </svg>
  ),
};

export function Sidebar({ active, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<WorkflowId | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-wordmark">
        <span className="sidebar-wordmark-text">p7</span>
      </div>

      <nav className="sidebar-nav">
        {WORKFLOWS.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={active === item.id}
            isHovered={hoveredId === item.id}
            onSelect={() => onSelect(item.id)}
            onHoverStart={() => setHoveredId(item.id)}
            onHoverEnd={() =>
              setHoveredId((curr) => (curr === item.id ? null : curr))
            }
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v0</span>
        <span className="sidebar-ai-badge" title="AI-assisted build">AI</span>
      </div>
    </aside>
  );
}

interface ItemProps {
  item: WorkflowMeta;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function SidebarItem({
  item,
  isActive,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: ItemProps) {
  return (
    <button
      type="button"
      className={"sidebar-item" + (isActive ? " is-active" : "")}
      onClick={onSelect}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      title={item.label}
      aria-label={item.label}
    >
      <span className="sidebar-item-glyph">{ICONS[item.id]}</span>
      {isHovered && (
        <div className="sidebar-tooltip" role="tooltip">
          <span className="sidebar-tooltip-label">{item.label}</span>
          <span className="sidebar-tooltip-sub">{item.sub}</span>
          <span className="sidebar-tooltip-arrow" aria-hidden="true" />
        </div>
      )}
    </button>
  );
}
