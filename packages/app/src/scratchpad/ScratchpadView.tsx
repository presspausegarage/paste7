import { useEffect, useRef, useState } from "react";
import { createEngine } from "@paste7/core";
import type { Engine, Format, RedactResult } from "@paste7/core";
import type { editor as MonacoEditor } from "monaco-editor";
import { Editor, monaco } from "../shared/monaco.js";
import { PhiPolicyModal } from "../shared/PhiPolicyModal.js";
import { TokenTreeView } from "./TokenTreeView.js";

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
  const [showPolicy, setShowPolicy] = useState(false);

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

  // Segment-level PHI tally for the Tokens pane label. A segment "has PHI" if
  // any direct child carries a redaction.
  const treeNodes = redactState.status === "ok" ? redactState.result.tree.nodes : [];
  const phiSegmentCount = treeNodes.filter((n) =>
    (n.children ?? []).some((c) => c.redaction !== undefined),
  ).length;
  const cleanSegmentCount = treeNodes.length - phiSegmentCount;

  // Custom Ctrl+V: prevents raw PHI from ever appearing in the editor by
  // redacting clipboard text before inserting. Image clipboard items are
  // detected and routed to a Phase 6 stub for future OCR. Failures surface
  // through redactState (rendered in the tokens pane) — the status-bar toast
  // was removed in the 2026-05-21 design uplift.
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
          setRedactState({
            status: "error",
            message: "Image paste isn't wired up yet — screenshot OCR arrives in Phase 6.",
          });
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
      setRedactState({ status: "error", message: `Clipboard read failed: ${message}` });
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
      setRedactState({ status: "error", message: `Paste blocked: ${message}` });
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
    // Success is silent — the editor onChange fires the debounced redact,
    // which refreshes the tokens pane within ~250ms.
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
  };

  const clearAll = () => {
    setContent("");
    setRedactState({ status: "idle" });
    engine.reset();
  };

  return (
    <div className="scratchpad-view">
      <header className="scratchpad-header">
        <div className="scratchpad-title">
          <span className="scratchpad-title-text">Scratchpad</span>
        </div>
        <div className="scratchpad-toolbar">
          <FormatSelect value={formatChoice} onChange={setFormatChoice} />
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
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, stroke: "var(--text-3)" }}
              >
                <path d="M3 2.5h4.5L9 4v6.5a.5.5 0 01-.5.5h-5.5a.5.5 0 01-.5-.5v-8a.5.5 0 01.5-.5z" />
                <path d="M7.5 2.5V4H9" />
                <path d="M4.5 6h4M4.5 7.5h3" />
              </svg>
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
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, stroke: "var(--text-3)" }}
              >
                <rect x="1" y="5.5" width="3" height="2" rx="0.5" />
                <rect x="9" y="2.5" width="3" height="2" rx="0.5" />
                <rect x="9" y="8.5" width="3" height="2" rx="0.5" />
                <path d="M4 6.5h2V3.5H9" />
                <path d="M6 6.5V9.5H9" />
              </svg>
              <span className="pane-label-text">Tokens</span>
              {redactState.status === "ok" && (
                <span className="pane-label-meta">
                  {phiSegmentCount} segment{phiSegmentCount === 1 ? "" : "s"} with PHI · {cleanSegmentCount} clean
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
      </div>

      {showPolicy && <PhiPolicyModal onClose={() => setShowPolicy(false)} />}

      <footer className="scratchpad-statusbar">
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
      </footer>
    </div>
  );
}

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

      <div className="empty-state-phase-note">Image paste (OCR) · Phase 6</div>
    </div>
  );
}

// Custom format dropdown — replaces the native <select>. Closes on outside
// click or option select. Typed against FormatChoice rather than raw strings.
function FormatSelect({
  value,
  onChange,
}: {
  value: FormatChoice;
  onChange: (v: FormatChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = FORMAT_OPTIONS.find((o) => o.value === value) ?? FORMAT_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="format-select" ref={ref}>
      <button
        type="button"
        className="format-select-btn"
        onClick={() => setOpen((o) => !o)}
      >
        {current.label}
        <span className={"format-select-chevron" + (open ? " is-open" : "")}>▼</span>
      </button>
      {open && (
        <div className="format-select-dropdown">
          {FORMAT_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={"format-select-option" + (opt.value === value ? " is-active" : "")}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
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
