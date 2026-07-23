# paste7

[![release](https://github.com/presspausegarage/paste7/actions/workflows/release.yml/badge.svg)](https://github.com/presspausegarage/paste7/actions/workflows/release.yml)

Lightweight desktop scratchpad for inspecting healthcare interop messages with PHI auto-redaction.

Paste an HL7 v2, HL7 v3, C-CDA, or FHIR message and see it tokenized with patient identifiers redacted in real time. Drop a DICOM Structured Report and inspect headers before exporting a sanitized copy. A planned Phase 6 workflow will ingest screenshots of HL7 v2 messages from viewer tools. In-memory only — message content is never written to disk.

**Status: v0.1.0 released.** The public Windows installer and SHA-256 checksum are available from [GitHub Releases](https://github.com/presspausegarage/paste7/releases/tag/v0.1.0). Phases 1–4 are complete; Phase 5 distribution is complete except for the planned Tauri built-in updater. Phase 6 OCR and Phase 7 MCP remain future work.

## Supported formats

| Format | UX | Status |
|---|---|---|
| HL7 v2.x | Paste | Phase 1-2 |
| HL7 v3 messaging | Paste | Phase 1-2 |
| C-CDA / CDA R2 | Paste | Phase 1-2 |
| FHIR JSON | Paste | Phase 1-2 |
| FHIR XML | Paste | Phase 1-2 |
| DICOM SR headers | File-drop | Phase 3 |
| HL7 v2 viewer screenshot | Image paste / file-drop + OCR | Phase 6 |

PHI rule packs anchor on HIPAA Safe Harbor's 18-identifier list (HL7 family) and a Structured-Report-scoped subset of DICOM PS 3.15 Basic Application Confidentiality Profile (DICOM SR headers).

## Distribution

- **License**: MIT, public GitHub.
- **Install**: per-user NSIS installer for Windows. No admin rights, no UAC. Installs to `%LOCALAPPDATA%\Programs\`. Download the [latest release](https://github.com/presspausegarage/paste7/releases/latest); verify the download against the published `.sha256` checksum.
- **Target**: Windows 10 21H2+ / Windows 11. WebView2 preinstalled.
- **Unsigned build**: code signing is deferred for the pilot phase. First install shows a one-time SmartScreen "More info → Run anyway" prompt — this is a missing OS-level trust signal, not a sign the binary is unsafe.
- **Updates**: Tauri built-in updater (planned, not yet wired), signed releases via GitHub Releases.

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

DICOM scope is **Structured Report (SR) header tags only** — no other modalities, no SR ContentSequence redaction, no pixel-data redaction of any kind. The tool will reject non-SR DICOM objects on file-drop.

Phase 6 OCR is scoped to **screenshots of HL7 v2 messages displayed in third-party viewer/integration tools**. Windows.Media.Ocr extracts text, an HL7 normalization pass cleans up viewer chrome and common OCR substitutions, and the result feeds the same HL7 v2 redaction pipeline as the paste flow. The deliverable is text + a tokenized redacted view — never an image.

## Affiliations

paste7 is not affiliated with or endorsed by Health Level Seven International, NEMA, ONC, HHS, or any vendor whose interop formats it handles.

## Third-party components

See [NOTICES.md](NOTICES.md).
