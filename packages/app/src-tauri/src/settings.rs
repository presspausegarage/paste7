// DPAPI-encrypted settings persistence.
//
// Scope is deliberately narrow: window size, default workflow, and DICOM
// retain sub-profile selection. Never message content -- that stays
// in-memory only per the app's core threat model (see docs/threat-model.md).
//
// Encrypted at rest with the Windows Data Protection API
// (CryptProtectData/CryptUnprotectData), per-user scope (no
// CRYPTPROTECT_LOCAL_MACHINE): the blob is tied to the Windows account
// that wrote it and decryptable only by that same account, with no key
// management on our side and no admin rights required either direction.
// CRYPTPROTECT_UI_FORBIDDEN keeps this fully non-interactive -- a DPAPI
// failure surfaces as a normal Result::Err, never an OS prompt.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use windows::core::PCWSTR;
use windows::Win32::Foundation::LocalFree;
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

const SETTINGS_FILE: &str = "settings.dat";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub window_width: f64,
    pub window_height: f64,
    pub default_workflow: String,
    pub dicom_retain_dates: bool,
    pub dicom_retain_uids: bool,
    pub dicom_retain_device_ids: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            window_width: 1280.0,
            window_height: 800.0,
            default_workflow: "scratchpad".to_string(),
            dicom_retain_dates: false,
            dicom_retain_uids: false,
            dicom_retain_device_ids: false,
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    Ok(dir.join(SETTINGS_FILE))
}

/// Encrypt `plaintext` with the current Windows user's DPAPI master key.
unsafe fn dpapi_protect(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    CryptProtectData(
        &input,
        PCWSTR::null(),
        None,
        None,
        None,
        CRYPTPROTECT_UI_FORBIDDEN,
        &mut output,
    )
    .map_err(|e| format!("CryptProtectData failed: {e}"))?;

    Ok(take_blob(output))
}

/// Decrypt bytes previously produced by `dpapi_protect`. Fails (rather than
/// prompting) for a blob written by a different Windows account.
unsafe fn dpapi_unprotect(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    CryptUnprotectData(
        &input,
        None,
        None,
        None,
        None,
        CRYPTPROTECT_UI_FORBIDDEN,
        &mut output,
    )
    .map_err(|e| format!("CryptUnprotectData failed: {e}"))?;

    Ok(take_blob(output))
}

/// Copy a CryptoAPI-owned output blob into a Rust `Vec<u8>` and free the
/// original with `LocalFree`, as required by the CryptProtectData /
/// CryptUnprotectData contract for their `pDataOut` blob.
unsafe fn take_blob(blob: CRYPT_INTEGER_BLOB) -> Vec<u8> {
    let bytes = if blob.pbData.is_null() || blob.cbData == 0 {
        Vec::new()
    } else {
        std::slice::from_raw_parts(blob.pbData, blob.cbData as usize).to_vec()
    };
    if !blob.pbData.is_null() {
        let _ = LocalFree(Some(windows::Win32::Foundation::HLOCAL(
            blob.pbData as *mut core::ffi::c_void,
        )));
    }
    bytes
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let encrypted = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let decrypted = unsafe { dpapi_unprotect(&encrypted) }?;
    serde_json::from_slice(&decrypted).map_err(|e| format!("settings file is corrupt: {e}"))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    let plaintext = serde_json::to_vec(&settings).map_err(|e| e.to_string())?;
    let encrypted = unsafe { dpapi_protect(&plaintext) }?;
    std::fs::write(&path, encrypted).map_err(|e| format!("{}: {e}", path.display()))
}
