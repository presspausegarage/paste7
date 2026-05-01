# Third-Party Notices

This project incorporates components from the following third-party projects.
All are compatible with the MIT License under which this project is distributed.

## Integrated dependencies

### Monaco Editor
- Source: https://github.com/microsoft/monaco-editor
- License: MIT
- Usage: Code editor primitive for the Scratchpad view (paste + redacted panes).

### @monaco-editor/react
- Source: https://github.com/suren-atoyan/monaco-react
- License: MIT
- Usage: React wrapper for Monaco Editor.

### React and React DOM
- Source: https://github.com/facebook/react
- License: MIT
- Usage: Frontend UI framework.

### Vite
- Source: https://github.com/vitejs/vite
- License: MIT
- Usage: Frontend build tool and dev server.

### @vitejs/plugin-react
- Source: https://github.com/vitejs/vite-plugin-react
- License: MIT
- Usage: Vite integration for React Fast Refresh.

### Tauri
- Source: https://github.com/tauri-apps/tauri
- License: MIT / Apache-2.0
- Usage: Desktop application shell, bundler, NSIS installer generation.

### Tauri plugins (shell, dialog, clipboard-manager, fs)
- Source: https://github.com/tauri-apps/plugins-workspace
- License: MIT / Apache-2.0
- Usage: Native capabilities exposed to the frontend (file dialogs, clipboard, scoped file I/O).

### fast-check
- Source: https://github.com/dubzzz/fast-check
- License: MIT
- Usage: Property-based testing for the PHI rule-pack engine.

### Vitest
- Source: https://github.com/vitest-dev/vitest
- License: MIT
- Usage: Unit and property-based test runner.

## Planned dependencies

These will be added as their respective phases land. Attribution is recorded here pre-emptively so the NOTICES file stays accurate.

### vscode-hl7 TextMate grammar
- Source: https://github.com/pagebrooks/vscode-hl7
- License: MIT
- Usage: HL7 v2 syntax grammar vendored for Monaco-based tokenization in the Scratchpad view.
- Status: not yet vendored (Phase 2).

### dicom-rs (or dcmjs, TBD)
- Source: https://github.com/Enet4/dicom-rs (or https://github.com/dcmjs-org/dcmjs)
- License: Apache-2.0 / MIT (dicom-rs); MIT (dcmjs)
- Usage: DICOM file parsing and sanitized export.
- Status: not yet integrated (Phase 3).
