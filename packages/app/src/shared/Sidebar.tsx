import { useState } from "react";
import { WORKFLOWS } from "./workflows.js";
import type { WorkflowId, WorkflowMeta } from "./workflows.js";

interface Props {
  active: WorkflowId;
  onSelect: (id: WorkflowId) => void;
}

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
      <span className="sidebar-item-glyph">{item.glyph}</span>
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
