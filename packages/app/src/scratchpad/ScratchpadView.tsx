import { useEffect, useState } from "react";
import { createEngine } from "@paste7/core";
import type { Engine, Finding, Format, RedactResult } from "@paste7/core";
import { Editor } from "../shared/monaco.js";
import { FindingsPanel } from "./FindingsPanel.js";
import { TokenTreeView } from "./TokenTreeView.js";

const NO_FINDINGS: ReadonlyArray<Finding> = [];

type RedactedView = "raw" | "tree";
type FormatChoice = Format | "auto";

const FORMAT_OPTIONS: ReadonlyArray<{ value: FormatChoice; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: "hl7v2", label: "HL7 v2" },
  { value: "hl7v3", label: "HL7 v3" },
  { value: "cda", label: "C-CDA" },
  { value: "fhir-json", label: "FHIR JSON" },
  { value: "fhir-xml", label: "FHIR XML" },
];

type RedactState =
  | { status: "idle" }
  | { status: "redacting" }
  | { status: "ok"; result: RedactResult }
  | { status: "error"; message: string };

const EDITOR_OPTIONS = {
  wordWrap: "on" as const,
  minimap: { enabled: false },
  fontFamily: "JetBrains Mono, Consolas, monospace",
  fontSize: 12,
  scrollBeyondLastLine: false,
  renderLineHighlight: "line" as const,
};

export function ScratchpadView() {
  const [engine] = useState<Engine>(() => createEngine());
  const [input, setInput] = useState<string>("");
  const debouncedInput = useDebouncedValue(input, 250);
  const [redactState, setRedactState] = useState<RedactState>({ status: "idle" });
  const [redactedView, setRedactedView] = useState<RedactedView>("raw");
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("auto");

  useEffect(() => {
    if (debouncedInput.trim() === "") {
      setRedactState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setRedactState({ status: "redacting" });

    const options = formatChoice === "auto" ? undefined : { format: formatChoice };
    engine
      .redact(debouncedInput, options)
      .then((result) => {
        if (cancelled) return;
        setRedactState({ status: "ok", result });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setRedactState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedInput, engine, formatChoice]);

  const redactedText = redactState.status === "ok" ? redactState.result.redacted : "";
  const findings = redactState.status === "ok" ? redactState.result.findings : NO_FINDINGS;

  return (
    <div className="scratchpad-view">
      <header className="scratchpad-header">
        <div className="scratchpad-title">Scratchpad</div>
        <div className="scratchpad-toolbar">
          <label className="format-select-label">
            Format
            <select
              className="format-select"
              value={formatChoice}
              onChange={(e) => setFormatChoice(e.target.value as FormatChoice)}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <FormatBadge state={redactState} choice={formatChoice} />
        </div>
      </header>

      <div className="scratchpad-body">
        <div className="scratchpad-panes">
          <section className="scratchpad-pane">
            <div className="scratchpad-pane-label">Paste</div>
            <div className="scratchpad-editor-wrap">
              <Editor
                height="100%"
                language="plaintext"
                theme="vs-dark"
                value={input}
                onChange={(value) => setInput(value ?? "")}
                options={EDITOR_OPTIONS}
              />
            </div>
          </section>

          <section className="scratchpad-pane">
            <div className="scratchpad-pane-label scratchpad-pane-label-row">
              <span>Redacted</span>
              <div className="view-toggle">
                <button
                  type="button"
                  className={"view-toggle-btn" + (redactedView === "raw" ? " is-active" : "")}
                  onClick={() => setRedactedView("raw")}
                >
                  Raw
                </button>
                <button
                  type="button"
                  className={"view-toggle-btn" + (redactedView === "tree" ? " is-active" : "")}
                  onClick={() => setRedactedView("tree")}
                >
                  Tree
                </button>
              </div>
            </div>
            <div className="scratchpad-editor-wrap">
              {redactedView === "raw" ? (
                <Editor
                  height="100%"
                  language="plaintext"
                  theme="vs-dark"
                  value={redactedText}
                  options={{ ...EDITOR_OPTIONS, readOnly: true }}
                />
              ) : redactState.status === "ok" ? (
                <TokenTreeView tree={redactState.result.tree} />
              ) : (
                <div className="tree-empty">
                  {redactState.status === "redacting"
                    ? "Redacting…"
                    : redactState.status === "error"
                      ? redactState.message
                      : "Paste content to see the tokenized tree."}
                </div>
              )}
            </div>
          </section>
        </div>

        <FindingsPanel findings={findings} />
      </div>

      <footer className="scratchpad-statusbar">
        <span className="phi-badge" title="PHI redaction is always on; pasted content stays in memory.">
          <span className="phi-dot" />
          PHI mode: ON
        </span>
        <StatusDetail state={redactState} />
      </footer>
    </div>
  );
}

function StatusDetail({ state }: { state: RedactState }) {
  if (state.status === "idle") return null;
  if (state.status === "redacting") {
    return <span className="scratchpad-statusbar-detail">redacting…</span>;
  }
  if (state.status === "error") {
    return (
      <span className="scratchpad-statusbar-detail scratchpad-statusbar-error" title={state.message}>
        {state.message}
      </span>
    );
  }
  const { format, findings } = state.result;
  return (
    <span className="scratchpad-statusbar-detail">
      {format} · {findings.length} finding{findings.length === 1 ? "" : "s"}
    </span>
  );
}

function FormatBadge({
  state,
  choice,
}: {
  state: RedactState;
  choice: FormatChoice;
}) {
  if (state.status !== "ok") return null;
  if (choice === "auto") {
    const pct = Math.round(state.result.detectionConfidence * 100);
    return (
      <span className="format-badge format-badge-auto">
        <span className="format-badge-prefix">detected</span>
        {state.result.format}
        <span className="format-badge-confidence">{pct}%</span>
      </span>
    );
  }
  return (
    <span className="format-badge format-badge-forced">
      <span className="format-badge-prefix">forced</span>
      {state.result.format}
    </span>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
