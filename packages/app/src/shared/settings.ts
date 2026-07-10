// Typed wrapper around the DPAPI-encrypted settings commands
// (packages/app/src-tauri/src/settings.rs).
//
// Scope is deliberately narrow -- window size, default workflow, DICOM
// retain sub-profile selection. Never message content: the `Persistable`
// constraint below makes adding a `SecretValue`-typed (or otherwise
// non-JSON) field to `AppSettings` a compile error, not a runtime leak
// found in review. See @paste7/core's secret.ts for the other half of this
// guard.

import { invoke } from "@tauri-apps/api/core";
import type { Persistable } from "@paste7/core";
import type { WorkflowId } from "./workflows.js";

export interface AppSettings {
  windowWidth: number;
  windowHeight: number;
  defaultWorkflow: WorkflowId;
  dicomRetainDates: boolean;
  dicomRetainUids: boolean;
  dicomRetainDeviceIds: boolean;
}

// Compile-time assertion, not a runtime check: if a future edit adds a
// field to AppSettings that isn't JSON-safe (a SecretValue<T>, a function,
// a class instance with private state, ...), `_AppSettingsIsPersistable`
// stops satisfying `AssertTrue` and `tsc` fails here rather than the leak
// being found in review. Checked per-property (not via whole-object
// assignability to Record<string, Persistable>) because a named interface
// without its own index signature can't satisfy one structurally even when
// every property is individually JSON-safe.
type ValuesArePersistable<T> = {
  [K in keyof T]: T[K] extends Persistable ? true : false;
}[keyof T];
type AssertTrue<T extends true> = T;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AppSettingsIsPersistable = AssertTrue<ValuesArePersistable<AppSettings>>;

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
