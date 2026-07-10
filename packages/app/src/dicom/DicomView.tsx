import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createDicomRedactor } from "@paste7/core";
import type { DicomFinding, DicomRedactResult } from "@paste7/core";
import { PhiPolicyModal } from "../shared/PhiPolicyModal.js";
import {
  pickDicomFile,
  readDicomFile,
  writeRedactedDicom,
  type DicomFilePick,
} from "./dicom-fs.js";

type ViewState =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "redacting"; path: string; bytes: Uint8Array }
  | { kind: "ready"; path: string; bytes: Uint8Array; result: DicomRedactResult }
  | { kind: "error"; path?: string; message: string };

export interface RetainFlags {
  dates: boolean;
  uids: boolean;
  deviceIds: boolean;
}

const NO_RETAIN: RetainFlags = { dates: false, uids: false, deviceIds: false };

export interface DicomViewProps {
  /** Persisted retain sub-profile selection (DPAPI-encrypted settings), if any. */
  initialRetain?: RetainFlags;
  /** Fired whenever the retain selection changes, so the caller can persist it. */
  onRetainChange?: (next: RetainFlags) => void;
}

export function DicomView({ initialRetain, onRetainChange }: DicomViewProps = {}) {
  const [state, setState] = useState<ViewState>({ kind: "idle" });
  const [retain, setRetain] = useState<RetainFlags>(initialRetain ?? NO_RETAIN);

  // Report retain changes upward for persistence, skipping the initial
  // mount (which just echoes `initialRetain` back) to avoid a redundant
  // settings write every time this view remounts (tab switch unmounts it).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onRetainChange?.(retain);
  }, [retain, onRetainChange]);
  const [exportState, setExportState] = useState<{
    kind: "idle" | "writing" | "ok" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  // Listen for Tauri-native drag-and-drop events on the WebView.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragActive(true);
        } else if (event.payload.type === "leave") {
          setDragActive(false);
        } else if (event.payload.type === "drop") {
          setDragActive(false);
          const paths = event.payload.paths;
          if (paths.length === 0) return;
          const path = paths[0]!;
          if (!path.toLowerCase().endsWith(".dcm")) {
            setState({ kind: "error", path, message: `Not a .dcm file: ${path}` });
            return;
          }
          loadFromPath(path);
        }
      })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {
        // Drag-drop unavailable (likely running outside Tauri). Click-to-pick still works.
      });
    return () => {
      unlisten?.();
    };
  }, []);

  // When state has bytes + retain flags, redact.
  const lastRunRef = useRef<{ bytes: Uint8Array; retain: RetainFlags } | null>(null);

  useEffect(() => {
    if (state.kind !== "redacting" && state.kind !== "ready") return;
    if (state.kind === "ready") {
      // Avoid re-running when only `state` shape change is irrelevant.
      const last = lastRunRef.current;
      if (last && last.bytes === state.bytes && retainEqual(last.retain, retain)) return;
    }

    const bytes = state.bytes;
    const path = state.path;
    let cancelled = false;

    setState({ kind: "redacting", path, bytes });
    const redactor = createDicomRedactor({
      retainDates: retain.dates,
      retainUids: retain.uids,
      retainDeviceIds: retain.deviceIds,
    });
    redactor
      .redactSrHeaders(bytes)
      .then((result) => {
        if (cancelled) return;
        lastRunRef.current = { bytes, retain };
        setState({ kind: "ready", path, bytes, result });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ kind: "error", path, message });
      });

    return () => {
      cancelled = true;
    };
  }, [state.kind === "redacting" || state.kind === "ready" ? state.bytes : null, retain]);

  const loadFromPath = async (path: string) => {
    setState({ kind: "loading", path });
    setExportState({ kind: "idle" });
    try {
      const pick: DicomFilePick = await readDicomFile(path);
      setState({ kind: "redacting", path: pick.path, bytes: pick.bytes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ kind: "error", path, message });
    }
  };

  const handlePickFile = async () => {
    setExportState({ kind: "idle" });
    try {
      const pick = await pickDicomFile();
      if (pick === null) return;
      setState({ kind: "redacting", path: pick.path, bytes: pick.bytes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ kind: "error", message });
    }
  };

  const handleExport = async () => {
    if (state.kind !== "ready") return;
    setExportState({ kind: "writing" });
    try {
      const dest = await writeRedactedDicom(state.path, state.result.redacted);
      setExportState({ kind: "ok", message: dest });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setExportState({ kind: "error", message });
    }
  };

  const handleClear = () => {
    setState({ kind: "idle" });
    setExportState({ kind: "idle" });
    lastRunRef.current = null;
  };

  return (
    <div className="dicom-view">
      <header className="dicom-header">
        <div className="dicom-title">
          <span className="dicom-title-text">DICOM SR</span>
          <span className="dicom-subtitle">structured report</span>
        </div>
        <div className="dicom-toolbar">
          <button
            type="button"
            className="phi-policy-trigger"
            onClick={() => setShowPolicy(true)}
            title="Show what each PHI category does and the redaction strategy applied"
          >
            Policy
          </button>
          <button type="button" className="dicom-btn" onClick={handlePickFile}>
            Open .dcm…
          </button>
          {state.kind === "ready" && (
            <>
              <button
                type="button"
                className="dicom-btn dicom-btn-primary"
                onClick={handleExport}
                disabled={exportState.kind === "writing"}
              >
                {exportState.kind === "writing" ? "Exporting…" : "Export redacted"}
              </button>
              <button type="button" className="dicom-btn dicom-btn-subtle" onClick={handleClear}>
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      <div className="dicom-body">
        {state.kind === "idle" && (
          <DropZone active={dragActive} onPick={handlePickFile} />
        )}
        {state.kind === "loading" && (
          <div className="dicom-status">Reading {basename(state.path)}…</div>
        )}
        {state.kind === "redacting" && (
          <div className="dicom-status">Redacting {basename(state.path)}…</div>
        )}
        {state.kind === "error" && (
          <div className="dicom-error">
            <div className="dicom-error-title">Could not load DICOM file</div>
            <div className="dicom-error-detail">{state.message}</div>
            <button type="button" className="dicom-btn" onClick={handlePickFile}>
              Pick another file
            </button>
          </div>
        )}
        {state.kind === "ready" && (
          <ReadyView
            result={state.result}
            path={state.path}
            retain={retain}
            onRetainChange={setRetain}
            exportState={exportState}
          />
        )}
      </div>

      {showPolicy && <PhiPolicyModal onClose={() => setShowPolicy(false)} />}

      <footer className="dicom-statusbar">
        <span className="phi-badge" title="PHI redaction is always on; in-memory only.">
          <span className="phi-dot" />
          PHI mode: ON
        </span>
        {state.kind === "ready" && (
          <span className="dicom-statusbar-detail">
            {state.result.sopClassName ?? state.result.sopClassUid} ·{" "}
            {state.result.findings.length} redaction
            {state.result.findings.length === 1 ? "" : "s"}
          </span>
        )}
        {exportState.kind === "ok" && (
          <span className="dicom-statusbar-detail dicom-statusbar-success">
            wrote {basename(exportState.message ?? "")}
          </span>
        )}
        {exportState.kind === "error" && (
          <span className="dicom-statusbar-detail dicom-statusbar-error">
            export failed: {exportState.message}
          </span>
        )}
      </footer>
    </div>
  );
}

function DropZone({ active, onPick }: { active: boolean; onPick: () => void }) {
  return (
    <div className={"dicom-dropzone" + (active ? " is-active" : "")}>
      <div className="dicom-dropzone-inner">
        <div className="caption">Drop a .dcm file here, or</div>
        <button type="button" className="dicom-btn dicom-btn-primary dicom-dropzone-btn" onClick={onPick}>
          Open .dcm file…
        </button>
        <div className="dicom-dropzone-subtitle caption">
          SR headers only — non-SR DICOM rejected. Pixel data and<br/>ContentSequence preserved verbatim. In-memory only.
        </div>
      </div>
    </div>
  );
}

function ReadyView({
  result,
  path,
  retain,
  onRetainChange,
  exportState,
}: {
  result: DicomRedactResult;
  path: string;
  retain: RetainFlags;
  onRetainChange: (next: RetainFlags) => void;
  exportState: { kind: "idle" | "writing" | "ok" | "error"; message?: string };
}) {
  return (
    <div className="dicom-ready">
      <section className="dicom-summary">
        <div className="dicom-summary-row">
          <span className="dicom-summary-label">Source</span>
          <span className="dicom-summary-value" title={path}>{basename(path)}</span>
        </div>
        <div className="dicom-summary-row">
          <span className="dicom-summary-label">SOP Class</span>
          <span className="dicom-summary-value">
            {result.sopClassName ?? "(unknown)"}
            <span className="dicom-summary-aside" title={result.sopClassUid}>
              {result.sopClassUid}
            </span>
          </span>
        </div>
        <div className="dicom-summary-row">
          <span className="dicom-summary-label">Redactions</span>
          <span className="dicom-summary-value">{result.findings.length}</span>
        </div>
        {result.parseErrors.length > 0 && (
          <div className="dicom-summary-row">
            <span className="dicom-summary-label">Parse warnings</span>
            <span className="dicom-summary-value">{result.parseErrors.length}</span>
          </div>
        )}
        {exportState.kind === "ok" && exportState.message && (
          <div className="dicom-summary-row">
            <span className="dicom-summary-label">Last export</span>
            <span className="dicom-summary-value" title={exportState.message}>
              {basename(exportState.message)}
            </span>
          </div>
        )}
      </section>

      <section className="dicom-retain">
        <div className="dicom-retain-label">PS 3.15 retain sub-profiles</div>
        <RetainToggle
          label="Dates"
          on={retain.dates}
          onChange={(v) => onRetainChange({ ...retain, dates: v })}
          hint="Keep birth dates, study/series/content dates verbatim"
        />
        <RetainToggle
          label="UIDs"
          on={retain.uids}
          onChange={(v) => onRetainChange({ ...retain, uids: v })}
          hint="Keep Study/Series/SOP Instance UIDs verbatim"
        />
        <RetainToggle
          label="Device identity"
          on={retain.deviceIds}
          onChange={(v) => onRetainChange({ ...retain, deviceIds: v })}
          hint="Keep manufacturer, model, station, AE titles verbatim"
        />
      </section>

      <section className="dicom-table-wrap">
        <FindingsTable findings={result.findings} />
      </section>
    </div>
  );
}

function RetainToggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  hint: string;
}) {
  return (
    <label className={"dicom-retain-toggle" + (on ? " is-on" : "")} title={hint}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FindingsTable({ findings }: { findings: ReadonlyArray<DicomFinding> }) {
  if (findings.length === 0) {
    return <div className="dicom-table-empty">No PHI tags matched in the rule pack.</div>;
  }
  return (
    <table className="dicom-table">
      <thead>
        <tr>
          <th>Tag</th>
          <th>VR</th>
          <th>Name</th>
          <th>Action</th>
          <th>Replacement</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((f, i) => (
          <tr key={`${f.tag}-${i}`}>
            <td className="dicom-cell-tag">{f.tag}</td>
            <td className="dicom-cell-vr">{f.vr}</td>
            <td>{f.name}</td>
            <td>
              <span className={`dicom-cell-strategy dicom-strat-${f.strategy}`}>
                {f.strategy}
              </span>
              <span className={`dicom-cell-cat dicom-cat-${f.category}`}>{f.category}</span>
            </td>
            <td className="dicom-cell-replacement" title={f.redactedValue ?? "[removed]"}>
              {f.redactedValue === null ? (
                <span className="dicom-cell-replacement-removed">[removed]</span>
              ) : f.redactedValue === "" ? (
                <span className="dicom-cell-replacement-removed">[scrubbed]</span>
              ) : (
                f.redactedValue
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function basename(path: string): string {
  if (!path) return "";
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function retainEqual(a: RetainFlags, b: RetainFlags): boolean {
  return a.dates === b.dates && a.uids === b.uids && a.deviceIds === b.deviceIds;
}
