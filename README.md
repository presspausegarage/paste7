# paste7

Lightweight desktop scratchpad for inspecting healthcare interop messages with PHI auto-redaction.

Paste an HL7 v2, HL7 v3, C-CDA, or FHIR message and see it tokenized with patient identifiers redacted in real time. Drop a DICOM file and inspect headers before exporting a sanitized copy. In-memory only — message content is never written to disk.

**Status: pre-alpha.** Tauri 2 + Vite + React + Monaco scaffold present; PHI engine and views in active development. Not yet usable.

## Supported formats

| Format | UX | Status |
|---|---|---|
| HL7 v2.x | Paste | Phase 1-2 |
| HL7 v3 messaging | Paste | Phase 1-2 |
| C-CDA / CDA R2 | Paste | Phase 1-2 |
| FHIR JSON | Paste | Phase 1-2 |
| FHIR XML | Paste | Phase 1-2 |
| DICOM headers | File-drop | Phase 3 |
| DICOM SC pixel-data (UI screenshots only) | File-drop + OCR | Phase 6 |

PHI rule packs anchor on HIPAA Safe Harbor's 18-identifier list (HL7 family) and DICOM PS 3.15 Basic Application Confidentiality Profile (DICOM headers).

## Distribution

- **License**: MIT, public GitHub.
- **Install**: per-user NSIS installer for Windows. No admin rights, no UAC. Installs to `%LOCALAPPDATA%\Programs\`.
- **Target**: Windows 10 21H2+ / Windows 11. WebView2 preinstalled.
- **Updates**: Tauri built-in updater, signed releases via GitHub Releases.

## Development

```bash
# Prerequisites: Node 20+, rustup, VS Build Tools (Desktop development with C++)
npm install
npm test --workspace=@paste7/core   # core engine tests
npm run typecheck
npm run dev                         # launch Tauri dev app
npm run dist                        # build NSIS installer
```

## PHI handling

paste7 performs best-effort de-identification for developer debugging and QA workflows. **It is not a certified HIPAA Safe Harbor tool.** Do not rely on it as a sole de-identification layer for data you intend to share or publish.

The redaction rule packs are anchored on HIPAA Safe Harbor's 18 identifiers. Jurisdictions outside the US (GDPR, UK DPA, PIPEDA, etc.) define health-data privacy under different terms and may have requirements this tool does not specifically address.

DICOM pixel-data PHI redaction is scoped to **Secondary Capture screenshots of clean application UIs** only. Burned-in modality text on diagnostic imaging pixels is out of scope. Phase 6 uses Windows.Media.Ocr for offline pixel-text detection at zero bundle cost.

## Affiliations

paste7 is not affiliated with or endorsed by Health Level Seven International, NEMA, ONC, HHS, or any vendor whose interop formats it handles.

## Third-party components

See [NOTICES.md](NOTICES.md).
