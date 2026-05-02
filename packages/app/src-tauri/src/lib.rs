// paste7 Tauri shell entry point.
//
// Keep this file minimal. Rust-side capabilities (DPAPI storage, DICOM file
// I/O, etc.) land in their own modules under src/ as each phase ships.

use std::fs;
use std::path::Path;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            ping,
            read_text_file,
            read_dicom_file,
            write_redacted_dicom
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// Read a UTF-8 text file the user has explicitly selected via a dialog.
///
/// Preferred over the fs plugin's scoped reads for user-initiated file
/// opens: the frontend first shows `dialog.open()` (user picks a path),
/// then passes the absolute path here. No capability-scope fiddling needed
/// because this command only runs on paths the user actively chose.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.is_absolute() {
        return Err(format!("path must be absolute: {}", path));
    }
    fs::read_to_string(p).map_err(|e| format!("{}: {}", path, e))
}

/// Read raw bytes from a user-selected DICOM file.
///
/// Frontend pre-validates the path with the dialog plugin (.dcm filter)
/// before invoking. Bytes are returned to the WebView for in-memory
/// parsing by `@paste7/core`'s DICOM SR redactor — they are not
/// persisted by Rust beyond the single-call return.
///
/// Caller-side restriction: the frontend only invokes this for paths
/// the user picked through the dialog. We add a defensive check that
/// the file extension is `.dcm` (case-insensitive) so an accidentally-
/// passed text path can't be slurped as bytes.
#[tauri::command]
fn read_dicom_file(path: String) -> Result<Vec<u8>, String> {
    let p = Path::new(&path);
    if !p.is_absolute() {
        return Err(format!("path must be absolute: {}", path));
    }
    let ext_ok = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.eq_ignore_ascii_case("dcm"))
        .unwrap_or(false);
    if !ext_ok {
        return Err(format!(
            "expected a .dcm file extension: {}",
            path
        ));
    }
    fs::read(p).map_err(|e| format!("{}: {}", path, e))
}

/// Write redacted DICOM bytes to `<original_path>.redacted.dcm`.
///
/// Three load-bearing invariants make this safe to expose:
///   1. Destination is *derived* from the user-supplied original path,
///      not user-supplied directly. Callers cannot specify an arbitrary
///      destination.
///   2. The constructed destination always ends in `.redacted.dcm`. If
///      the original is somehow not `.dcm`, we refuse to write rather
///      than potentially overwriting a non-DICOM file.
///   3. Existing destination files at the derived path are overwritten
///      silently — that path is only ever produced by this command, so
///      overwriting our own prior export is the correct UX.
///
/// Returns the destination path on success.
#[tauri::command]
fn write_redacted_dicom(original_path: String, bytes: Vec<u8>) -> Result<String, String> {
    let original = Path::new(&original_path);
    if !original.is_absolute() {
        return Err(format!("original_path must be absolute: {}", original_path));
    }
    let original_ext_ok = original
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.eq_ignore_ascii_case("dcm"))
        .unwrap_or(false);
    if !original_ext_ok {
        return Err(format!(
            "original_path must end with .dcm: {}",
            original_path
        ));
    }
    // Drop the .dcm and append .redacted.dcm. file_stem strips the
    // last extension only, which is what we want.
    let stem = original
        .file_stem()
        .ok_or_else(|| format!("could not derive file stem: {}", original_path))?;
    let parent = original
        .parent()
        .ok_or_else(|| format!("could not derive parent dir: {}", original_path))?;
    let mut dest_name = stem.to_owned();
    dest_name.push(".redacted.dcm");
    let dest = parent.join(dest_name);

    // Belt-and-suspenders: verify the destination actually ends with
    // `.redacted.dcm` before writing.
    let dest_str = dest
        .to_str()
        .ok_or_else(|| "destination path is not valid UTF-8".to_string())?;
    if !dest_str.to_ascii_lowercase().ends_with(".redacted.dcm") {
        return Err(format!(
            "refusing to write: destination does not end with .redacted.dcm ({})",
            dest_str
        ));
    }

    fs::write(&dest, &bytes).map_err(|e| format!("{}: {}", dest_str, e))?;
    Ok(dest_str.to_string())
}
