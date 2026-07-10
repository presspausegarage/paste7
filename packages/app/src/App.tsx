import { useEffect, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Sidebar } from "./shared/Sidebar.js";
import { ScratchpadView } from "./scratchpad/ScratchpadView.js";
import { DicomView, type RetainFlags } from "./dicom/DicomView.js";
import type { WorkflowId } from "./shared/workflows.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "./shared/settings.js";

export function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<WorkflowId>(DEFAULT_SETTINGS.defaultWorkflow);

  // Load persisted (DPAPI-encrypted) settings once on mount; apply the
  // remembered default workflow and window size.
  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then(async (loadedSettings) => {
        if (cancelled) return;
        setSettings(loadedSettings);
        setActive(loadedSettings.defaultWorkflow);
        await getCurrentWindow().setSize(
          new LogicalSize(loadedSettings.windowWidth, loadedSettings.windowHeight),
        );
      })
      .catch(() => {
        // First run, a corrupt file, or a blob written by a different
        // Windows account (DPAPI can't decrypt across accounts) -- keep
        // the compiled-in defaults rather than surfacing an error.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change, once the initial load has resolved -- guards against
  // a pre-load render clobbering a real settings file with defaults.
  useEffect(() => {
    if (!loaded) return;
    void saveSettings(settings);
  }, [loaded, settings]);

  // Debounced window-resize -> settings. Tauri delivers physical pixels;
  // settings are stored logical (DPI-independent) to match tauri.conf.json.
  useEffect(() => {
    if (!loaded) return;
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void getCurrentWindow()
      .onResized(({ payload }) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const scale = window.devicePixelRatio || 1;
          setSettings((prev) => ({
            ...prev,
            windowWidth: Math.round(payload.width / scale),
            windowHeight: Math.round(payload.height / scale),
          }));
        }, 500);
      })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {
        // Running outside Tauri (e.g. browser dev preview) -- no-op.
      });
    return () => {
      clearTimeout(timer);
      unlisten?.();
    };
  }, [loaded]);

  const handleSelect = (next: WorkflowId) => {
    setActive(next);
    setSettings((prev) => ({ ...prev, defaultWorkflow: next }));
  };

  const handleRetainChange = (retain: RetainFlags) => {
    setSettings((prev) => ({
      ...prev,
      dicomRetainDates: retain.dates,
      dicomRetainUids: retain.uids,
      dicomRetainDeviceIds: retain.deviceIds,
    }));
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={handleSelect} />
      <main className="app-main">
        {active === "scratchpad" && <ScratchpadView />}
        {active === "dicom" && (
          <DicomView
            initialRetain={{
              dates: settings.dicomRetainDates,
              uids: settings.dicomRetainUids,
              deviceIds: settings.dicomRetainDeviceIds,
            }}
            onRetainChange={handleRetainChange}
          />
        )}
      </main>
    </div>
  );
}
