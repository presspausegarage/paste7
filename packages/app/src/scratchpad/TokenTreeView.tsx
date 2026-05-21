import type { TokenNode, TokenTree } from "@paste7/core";

interface Props {
  tree: TokenTree;
}

/** A segment "has PHI" if any direct child carries a redaction. */
function hasPhi(node: TokenNode): boolean {
  return (node.children ?? []).some((c) => c.redaction !== undefined);
}

export function TokenTreeView({ tree }: Props) {
  if (tree.nodes.length === 0) {
    return <div className="tree-empty">Empty tree.</div>;
  }

  // Focused view: only segments with PHI findings are shown in the tree;
  // clean segments collapse into a single footer summary row. Within a
  // visible segment, only the redacted fields render — but those fields keep
  // their full component/subcomponent children so drill-down stays intact.
  const visibleNodes = tree.nodes.filter(hasPhi);
  const hiddenNodes = tree.nodes.filter((n) => !hasPhi(n));

  return (
    <div className="tree-view">
      {visibleNodes.map((node, i) => {
        const phiChildren = (node.children ?? []).filter(
          (c) => c.redaction !== undefined,
        );
        return (
          <TreeNode
            key={`${node.path}-${i}`}
            node={{ ...node, children: phiChildren }}
            depth={0}
          />
        );
      })}

      {hiddenNodes.length > 0 && (
        <div className="tree-row-hidden-summary">
          <span className="tree-hidden-label">
            {hiddenNodes.length} segment{hiddenNodes.length !== 1 ? "s" : ""} with no findings —
          </span>
          <span className="tree-hidden-paths">
            {hiddenNodes.map((n) => n.path).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

interface NodeProps {
  node: TokenNode;
  depth: number;
}

function TreeNode({ node, depth }: NodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isRedacted = node.redaction !== undefined;

  if (!hasChildren) {
    return (
      <div className="tree-row tree-row-leaf" style={{ paddingLeft: `${10 + depth * 14}px` }}>
        <NodeBody node={node} isRedacted={isRedacted} />
      </div>
    );
  }

  // Segment branches (depth 0) report a PHI-finding count — their children
  // are pre-filtered to redacted fields. Deeper branches (a redacted field's
  // component children) report a plain structural count.
  const childCount = node.children!.length;
  const childCountLabel = depth === 0 ? `${childCount} PHI` : `${childCount}`;
  return (
    <details className="tree-row tree-row-branch" open={depth === 0}>
      <summary className="tree-row-summary" style={{ paddingLeft: `${10 + depth * 14}px` }}>
        <NodeBody node={node} isRedacted={isRedacted} childCountLabel={childCountLabel} />
      </summary>
      <div className="tree-children">
        {node.children!.map((child, i) => (
          <TreeNode key={`${child.path}-${i}`} node={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

function NodeBody({
  node,
  isRedacted,
  childCountLabel,
}: {
  node: TokenNode;
  isRedacted: boolean;
  childCountLabel?: string;
}) {
  const pathClass = isRedacted
    ? `tree-path tree-path-redacted tree-path-cat-${node.redaction!.category}`
    : `tree-path tree-path-${node.kind}`;
  return (
    <>
      <span
        className={pathClass}
        title={`${node.kind} · ${node.path}${isRedacted ? ` · ${node.redaction!.category}` : ""}`}
      >
        {displayPath(node.path)}
      </span>
      <span className="tree-label" title={node.path}>{node.label}</span>
      {childCountLabel !== undefined && (
        <span className="tree-childcount">{childCountLabel}</span>
      )}
      {childCountLabel === undefined && <NodeValue node={node} isRedacted={isRedacted} />}
    </>
  );
}

/**
 * Format a path for the badge slot:
 * - HL7 v2 paths (`MSH`, `PID-3.1`) — verbatim, they're already compact
 * - XML paths (`/ClinicalDocument/recordTarget/patientRole/patient/name/given`)
 *   — last two segments joined, e.g. `name/given`
 * - XML attribute paths (`.../birthTime/@value`) — last element + attribute,
 *   e.g. `birthTime/@value`
 * - FHIR JSON paths (`Patient.name[0].given[0]`) — last two segments,
 *   e.g. `name[0].given[0]`
 *
 * Full path stays available via the `title` attribute on the parent span.
 */
function displayPath(path: string): string {
  if (path === "") return "";
  if (path.startsWith("/")) {
    const parts = path.split("/").filter((p) => p.length > 0);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }
  if (path.includes(".") && /^[A-Z][A-Za-z]/.test(path) && !/^[A-Z]{3}-/.test(path)) {
    // FHIR-JSON style: starts with capital letter (resourceType) and dotted.
    const parts = path.split(".");
    if (parts.length <= 2) return path;
    return parts.slice(-2).join(".");
  }
  // HL7 v2 (MSH, PID-3, PID-3.1) and anything else — show as-is.
  return path;
}

function NodeValue({ node, isRedacted }: { node: TokenNode; isRedacted: boolean }) {
  if (node.value === null) {
    return <span className="tree-value tree-value-removed">[removed]</span>;
  }
  if (node.value === "") {
    return <span className="tree-value tree-value-empty">(empty)</span>;
  }
  if (isRedacted) {
    const cat = node.redaction!.category;
    return (
      <>
        <span className={`tree-cat tree-cat-${cat}`} title={node.redaction!.rule}>{cat}</span>
        <span className="tree-value tree-value-redacted">{node.value}</span>
      </>
    );
  }
  return <span className="tree-value">{node.value}</span>;
}
