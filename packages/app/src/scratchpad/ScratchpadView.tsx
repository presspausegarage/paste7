import { useEffect, useState } from "react";
import { createEngine } from "@paste7/core";
import type { Engine, RedactResult } from "@paste7/core";
import { Editor } from "../shared/monaco.js";

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

  useEffect(() => {
    if (debouncedInput.trim() === "") {
      setRedactState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setRedactState({ status: "redacting" });

    engine
      .redact(debouncedInput)
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
  }, [debouncedInput, engine]);

  const redactedText = redactState.status === "ok" ? redactState.result.redacted : "";

  return (
    <div className="scratchpad-view">
      <header className="scratchpad-header">
        <div className="scratchpad-title">Scratchpad</div>
      </header>

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
          <div className="scratchpad-pane-label">Redacted</div>
          <div className="scratchpad-editor-wrap">
            <Editor
              height="100%"
              language="plaintext"
              theme="vs-dark"
              value={redactedText}
              options={{ ...EDITOR_OPTIONS, readOnly: true }}
            />
          </div>
        </section>
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

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
