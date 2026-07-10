// Typed wrapper around the DPAPI-encrypted settings commands
// (packages/app/src-tauri/src/settings.rs).
//
// Scope is deliberately narrow -- window size, default workflow, DICOM
// retain sub-profile selection. Never message content; see the redaction
// engine's own SecretValue guard for what keeps it that way.

import { invoke } from "@tauri-apps/api/core";
import type { WorkflowId } from "./workflows.js";

export interface AppSettings {
  windowWidth: number;
  windowHeight: number;
  defaultWorkflow: WorkflowId;
  dicomRetainDates: boolean;
  dicomRetainUids: boolean;
  dicomRetainDeviceIds: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  windowWidth: 1280,
  windowHeight: 800,
  defaultWorkflow: "scratchpad",
  dicomRetainDates: false,
  dicomRetainUids: false,
  dicomRetainDeviceIds: false,
};

/** Loads persisted settings, falling back to defaults on first run or a corrupt/foreign-account blob. */
export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke<void>("save_settings", { settings });
}
