import { useMemo, useState } from "react";
import type { Finding, PHICategory } from "@paste7/core";

interface Props {
  findings: ReadonlyArray<Finding>;
}

const CATEGORY_LABELS: Record<PHICategory, string> = {
  name: "name",
  id: "id",
  address: "address",
  phone: "phone",
  email: "email",
  date: "date",
  geo: "geo",
  "device-id": "device",
  url: "url",
  biometric: "biometric",
  photo: "photo",
  "free-text": "free-text",
};

export function FindingsPanel({ findings }: Props) {
  const [activeCategories, setActiveCategories] = useState<ReadonlySet<PHICategory>>(
    () => new Set(),
  );

  const presentCategories = useMemo<ReadonlyArray<PHICategory>>(() => {
    const seen = new Set<PHICategory>();
    for (const f of findings) seen.add(f.category);
    return [...seen].sort();
  }, [findings]);

  const visible = useMemo(() => {
    if (activeCategories.size === 0) return findings;
    return findings.filter((f) => activeCategories.has(f.category));
  }, [findings, activeCategories]);

  const toggleCategory = (cat: PHICategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <aside className="findings-panel">
      <header className="findings-header">
        <span className="findings-title">Findings</span>
        <span className="findings-count">
          {visible.length}
          {activeCategories.size > 0 && ` / ${findings.length}`}
        </span>
      </header>

      {presentCategories.length > 0 && (
        <div className="findings-filters">
          {presentCategories.map((cat) => {
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                className={"findings-chip" + (active ? " is-active" : "")}
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      )}

      <ul className="findings-list">
        {visible.length === 0 && findings.length === 0 && (
          <li className="findings-empty">No findings — paste some content.</li>
        )}
        {visible.length === 0 && findings.length > 0 && (
          <li className="findings-empty">No findings match the active filter.</li>
        )}
        {visible.map((f, i) => (
          <li key={`${f.rule}-${f.path}-${i}`} className="finding-item">
            <div className="finding-row">
              <span className={`finding-cat finding-cat-${f.category}`}>
                {CATEGORY_LABELS[f.category]}
              </span>
              <span className="finding-path" title={f.path}>{f.path}</span>
            </div>
            <div className="finding-row finding-row-secondary">
              <span className="finding-rule" title={f.rule}>{f.rule}</span>
              <span className="finding-strategy">{f.strategy}</span>
            </div>
            {f.redactedValue !== null && (
              <div className="finding-replacement" title={`Replaces ${f.originalLength} chars`}>
                → {f.redactedValue}
              </div>
            )}
            {f.redactedValue === null && (
              <div className="finding-replacement finding-replacement-removed">
                {f.strategy === "remove" ? "[removed]" : "[scrubbed]"}
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
