import { useEffect, useRef, useState } from "react";
import { createEngine } from "@paste7/core";
import type { Engine, Finding, Format, RedactResult } from "@paste7/core";
import type { editor as MonacoEditor } from "monaco-editor";
import { Editor, monaco } from "../shared/monaco.js";
import { FindingsPanel } from "./FindingsPanel.js";
import { TokenTreeView } from "./TokenTreeView.js";

const NO_FINDINGS: ReadonlyArray<Finding> = [];

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
  const [content, setContent] = useState<string>("");
  const debouncedContent = useDebouncedValue(content, 250);
  const [redactState, setRedactState] = useState<RedactState>({ status: "idle" });
  const [formatChoice, setFormatChoice] = useState<FormatChoice>("auto");
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "info"; text: string } | null>(null);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  // Format choice + engine accessed inside paste handler — keep refs current.
  const formatChoiceRef = useRef(formatChoice);
  formatChoiceRef.current = formatChoice;
  const engineRef = useRef(engine);

  // Debounced re-redact for findings/tree updates as the user types/edits.
  // The editor content IS the redacted form (raw PHI never reaches the editor
  // because the custom Ctrl+V handler redacts before insertion). Re-redacting
  // already-redacted content is a no-op — bindings cache stabilizes fakes.
  useEffect(() => {
    if (debouncedContent.trim() === "") {
      setRedactState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setRedactState({ status: "redacting" });
    const options = formatChoice === "auto" ? undefined : { format: formatChoice };
    engine
      .redact(debouncedContent, options)
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
  }, [debouncedContent, engine, formatChoice]);

  const findings = redactState.status === "ok" ? redactState.result.findings : NO_FINDINGS;

  const showToast = (kind: "ok" | "warn" | "info", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2400);
  };

  // Custom Ctrl+V: prevents raw PHI from ever appearing in the editor by
  // redacting clipboard text before inserting. Image clipboard items are
  // detected and routed to a Phase 6 stub for future OCR; for now just
  // surfaces a "coming soon" notice so the user knows the wire exists.
  const handleCustomPaste = async () => {
    const editor = editorRef.current;
    if (!editor) return;

    let clipboardItems: ClipboardItems | null = null;
    try {
      clipboardItems = await navigator.clipboard.read();
    } catch {
      // Browsers without clipboard.read fall back to readText.
      clipboardItems = null;
    }

    // Image-paste detection — Phase 6 hook.
    if (clipboardItems !== null) {
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType !== undefined) {
          showToast("info", "Image paste detected — OCR coming in Phase 6.");
          return;
        }
      }
    }

    // Text path: read, redact, insert redacted at the current selection.
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      showToast("warn", `clipboard read failed: ${message}`);
      return;
    }
    if (text === "") return;

    const opts = formatChoiceRef.current === "auto"
      ? undefined
      : { format: formatChoiceRef.current as Format };
    let result: RedactResult;
    try {
      result = await engineRef.current.redact(text, opts);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      showToast("warn", `paste blocked: ${message}`);
      return;
    }

    const selection = editor.getSelection() ?? new monaco.Selection(1, 1, 1, 1);
    editor.executeEdits("paste-redact", [
      {
        range: selection,
        text: result.redacted,
        forceMoveMarkers: true,
      },
    ]);
    showToast("ok", `pasted · ${result.findings.length} redaction${result.findings.length === 1 ? "" : "s"}`);
  };

  const onEditorMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Override Ctrl+V (and Cmd+V) so raw clipboard contents never reach the
    // editor without going through redaction first.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
      () => {
        void handleCustomPaste();
      },
    );
  };

  const copyRedacted = async () => {
    if (content === "") return;
    await navigator.clipboard.writeText(content);
    showToast("ok", "copied redacted");
  };

  const clearAll = () => {
    setContent("");
    setRedactState({ status: "idle" });
    engine.reset();
    showToast("info", "cleared session");
  };

  return (
    <div className="scratchpad-view">
      <header className="scratchpad-header">
        <div className="scratchpad-title">
          <span className="scratchpad-title-text">Scratchpad</span>
          <span className="scratchpad-subtitle">paste-and-redact</span>
        </div>
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
          <div className="copy-group" role="group" aria-label="Actions">
            <button
              type="button"
              className="copy-btn copy-btn-primary"
              onClick={copyRedacted}
              disabled={content === ""}
              title="Copy the redacted content to clipboard"
            >
              Copy
            </button>
            <button
              type="button"
              className="copy-btn copy-btn-secondary"
              onClick={clearAll}
              disabled={content === ""}
              title="Clear the editor and reset identity bindings"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="scratchpad-body">
        <div className="scratchpad-panes">
          <section className="scratchpad-pane scratchpad-pane-paste">
            <div className="scratchpad-pane-label">
              <span className="pane-label-stripe pane-label-stripe-paste" />
              <span className="pane-label-text">Paste</span>
              <span className="pane-label-hint">text now · screenshots in Phase 6</span>
            </div>
            <div className="scratchpad-editor-wrap">
              <Editor
                height="100%"
                language="plaintext"
                theme="vs-dark"
                value={content}
                onMount={onEditorMount}
                onChange={(value) => setContent(value ?? "")}
                options={EDITOR_OPTIONS}
              />
              {content === "" && <EmptyState />}
            </div>
          </section>

          <section className="scratchpad-pane scratchpad-pane-tree">
            <div className="scratchpad-pane-label">
              <span className="pane-label-stripe pane-label-stripe-tree" />
              <span className="pane-label-text">Tokenized values</span>
              {redactState.status === "ok" && (
                <span className="pane-label-meta">
                  {redactState.result.tree.nodes.length} segment{redactState.result.tree.nodes.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="scratchpad-editor-wrap">
              {redactState.status === "ok" ? (
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
        {toast && (
          <span className={`scratchpad-statusbar-toast scratchpad-statusbar-toast-${toast.kind}`}>
            {toast.text}
          </span>
        )}
      </footer>
    </div>
  );
}

const SUPPORTED_FORMATS: ReadonlyArray<{ label: string; example: string }> = [
  { label: "HL7 v2.x", example: "MSH|^~\\&|…" },
  { label: "HL7 v3", example: "<PRPA_IN201301UV02…" },
  { label: "C-CDA", example: "<ClinicalDocument…" },
  { label: "FHIR JSON", example: '{"resourceType":"Patient"…' },
  { label: "FHIR XML", example: "<Patient xmlns=…" },
];

function EmptyState() {
  return (
    <div className="empty-state" aria-hidden="true">
      <div className="empty-state-headline">
        <div className="empty-state-eyebrow caption caption--accent">paste-and-redact scratchpad</div>
        <div className="empty-state-title">Paste a message to begin</div>
        <div className="empty-state-subtitle">
          Raw PHI is redacted before it ever appears. Content stays in memory — nothing is written to disk.
        </div>
      </div>

      <div className="empty-state-shortcut">
        <span className="empty-state-keycap">Ctrl</span>
        <span className="empty-state-keycap-plus">+</span>
        <span className="empty-state-keycap">V</span>
        <span className="empty-state-shortcut-hint">to paste and redact</span>
      </div>

      <div className="empty-state-formats">
        <div className="empty-state-formats-header">
          <span className="caption">Supported formats</span>
          <span className="meta-pill empty-state-formats-pill">auto-detect</span>
        </div>
        <ul className="empty-state-formats-list">
          {SUPPORTED_FORMATS.map((f) => (
            <li key={f.label} className="empty-state-formats-row">
              <span className="empty-state-formats-label">{f.label}</span>
              <span className="empty-state-formats-example">{f.example}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="empty-state-phase-note">Image paste (OCR) · Phase 6</div>
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
