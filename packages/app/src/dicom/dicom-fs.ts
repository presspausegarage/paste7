// Tauri command wrappers for the DICOM workflow.
//
// Two narrow surfaces: read raw bytes from a user-selected .dcm file,
// and write redacted bytes to `<original>.redacted.dcm`. The Rust side
// (lib.rs) enforces the destination naming so the JS layer cannot
// accidentally overwrite an arbitrary path.

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export interface DicomFilePick {
  path: string;
  bytes: Uint8Array;
}

/** Show a native open-file dialog filtered to .dcm and read the picked bytes. */
export async function pickDicomFile(): Promise<DicomFilePick | null> {
  const selected = await open({
    title: "Open DICOM file",
    multiple: false,
    directory: false,
    filters: [
      { name: "DICOM", extensions: ["dcm"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (selected === null || Array.isArray(selected)) return null;
  return readDicomFile(selected);
}

/** Read raw bytes from an absolute DICOM path. Caller must ensure the
 *  user picked the path explicitly (drag-drop or open dialog). */
export async function readDicomFile(path: string): Promise<DicomFilePick> {
  const bytesNumeric = await invoke<number[]>("read_dicom_file", { path });
  return { path, bytes: new Uint8Array(bytesNumeric) };
}

/**
 * Write redacted DICOM bytes to `<originalPath>.redacted.dcm` (Rust side
 * derives the destination — JS cannot influence target naming beyond
 * choosing the source path). Returns the absolute destination path.
 */
export async function writeRedactedDicom(
  originalPath: string,
  bytes: Uint8Array,
): Promise<string> {
  return invoke<string>("write_redacted_dicom", {
    originalPath,
    bytes: Array.from(bytes),
  });
}
