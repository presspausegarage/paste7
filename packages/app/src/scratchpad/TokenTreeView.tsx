import type { TokenNode, TokenTree } from "@paste7/core";

interface Props {
  tree: TokenTree;
}

export function TokenTreeView({ tree }: Props) {
  if (tree.nodes.length === 0) {
    return <div className="tree-empty">Empty tree.</div>;
  }
  return (
    <div className="tree-view">
      {tree.nodes.map((node, i) => (
        <TreeNode key={`${node.path}-${i}`} node={node} depth={0} />
      ))}
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

  const childCount = node.children!.length;
  return (
    <details className="tree-row tree-row-branch" open={depth === 0}>
      <summary className="tree-row-summary" style={{ paddingLeft: `${10 + depth * 14}px` }}>
        <NodeBody node={node} isRedacted={isRedacted} childCount={childCount} />
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
  childCount,
}: {
  node: TokenNode;
  isRedacted: boolean;
  childCount?: number;
}) {
  return (
    <>
      <span className={`tree-kind tree-kind-${node.kind}`}>{node.kind}</span>
      <span className="tree-label" title={node.path}>{node.label}</span>
      {childCount !== undefined && (
        <span className="tree-childcount">{childCount}</span>
      )}
      {childCount === undefined && <NodeValue node={node} isRedacted={isRedacted} />}
    </>
  );
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
