# paste7 — Threat model

Phase 4 deliverable. Covers the app as it actually exists at the time of writing (2026-07-09):
Scratchpad (paste-and-redact for HL7 v2/v3, C-CDA, FHIR JSON/XML) and DICOM SR (file-drop
header redaction). Phase 6 (OCR ingest) and Phase 7 (local MCP server) are **not implemented**
yet — see [Anticipated future surface](#anticipated-future-surface-not-yet-built) for how they
change this model when they land; don't use this doc as their spec.

This is not a compliance artifact. paste7 is described in its own README/CLAUDE.md as
"PHI redaction primitives," not "HIPAA-compliant" — compliance is an operational property of
how an organization uses the tool, not a code-level guarantee this document can make.

---

## 1. What we're protecting

| Asset | Where it lives | Lifetime |
|---|---|---|
| Pasted message text (HL7 v2/v3, CDA, FHIR) — may contain real PHI if a user pastes a real message | React state + Monaco editor model, WebView2 renderer process memory | Until navigated away, cleared, or app closed. Never written to disk by app code (verified below). |
| DICOM file bytes + parsed header dataset | WebView2 renderer memory (bytes read via IPC, parsed by `dcmjs` in JS) | Same as above, per loaded file. |
| Identity-binding session state (`sha256(category+original) → fake`) | `Engine`/`DicomRedactor` instance in renderer memory | Lives for the `ScratchpadView`/`DicomView` mount; `reset()` on Clear. Map keys are hashes, not plaintext originals (locked decision, `engine-contract.md` §7). |
| Exported redacted DICOM file (`<name>.redacted.dcm`) | User's filesystem, wherever the source file lived | Persists until the user deletes it. This is the one asset that's *intentionally* written to disk — by design (Save-as, never overwrite the source). |
| Redacted / original text copied via the Copy buttons | OS clipboard | Until overwritten by the next clipboard write (app or otherwise) or system clear. |
| App settings (Phase 4, not yet built) | Will be DPAPI-encrypted local file | N/A yet — see §6. |

**Non-asset, explicitly**: paste7 does not store a corpus of messages, does not have accounts,
does not sync anywhere, and (confirmed by grep across `packages/app/src` and
`packages/core/src`) contains zero calls to `localStorage`, `sessionStorage`, `indexedDB`,
`writeTextFile`, `writeFile`, or `writeBinaryFile` anywhere in the codebase — not just in the
`scratchpad/**`/`dicom/**` subtrees the `lint-in-memory.mjs` script enforces. The in-memory
claim in the README holds at the whole-app level today, not just in the linted views.

## 2. Actors and trust levels

- **The interactive local user** — trusted. They run the app on their own machine and choose
  what to paste or drop. paste7 has no auth model; whoever can run the `.exe` is "the user."
- **paste7's own code** — trusted by construction, but see supply chain below: most of the
  attack surface that matters is *this code processing untrusted input*, not this code being
  malicious.
- **Third-party npm dependencies** (`dcmjs`, `fast-xml-parser`, `hl7-dictionary`,
  `monaco-editor`, the `@tauri-apps/*` plugins, transitive deps) — semi-trusted. A compromised
  package is the realistic supply-chain threat for a solo-maintained OSS project. Mitigated by
  Dependabot (weekly, per workspace convention) and by the fact there are few runtime deps in
  `@paste7/core` (three: `dcmjs`, `fast-xml-parser`, `hl7-dictionary`).
- **The pasted/dropped content itself** — untrusted. HL7/CDA/FHIR text and DICOM files may come
  from anywhere (a third-party viewer, a colleague, a downloaded sample) and are parsed by this
  app specifically because the user doesn't yet trust what's inside them.
- **No network adversary** — out of scope by design. paste7 has zero network capability: no
  `http:*` permission in `capabilities/default.json`, no server code, and the CSP's
  `connect-src 'self' ipc: http://ipc.localhost` blocks the webview from making arbitrary
  outbound `fetch`/`XHR`/`WebSocket` calls even if something in the page tried to (compromised
  dependency, XSS-style injection via a crafted message — see §4.4). This is a real,
  already-shipped mitigation worth naming explicitly: even in the worst case where untrusted
  content somehow got script execution in the webview, it can't phone PHI home over the
  network, because the browser engine itself will refuse the connection.
- **Local malicious actor with code-execution on the same Windows account** — out of scope.
  If someone can already run arbitrary code as the same user, they can read WebView2 process
  memory, the clipboard, or any file the OS user can read; no desktop app defends against that.
  This matches the workspace's own threat model for the box the app runs on (see
  `feedback_unlock_threat_model` — console-lock state, not network exposure, is the boundary
  that matters here).

## 3. Attack surface

### 3.1 Paste input → walkers (Scratchpad)

Untrusted text in five formats reaches three parsers: a hand-written HL7 v2 tokenizer,
`JSON.parse` (FHIR JSON), and `fast-xml-parser` (HL7 v3, CDA, FHIR XML).

- **XXE (XML External Entity)** — the classic risk for any XML parser fed untrusted input
  (local file disclosure via `<!ENTITY xxe SYSTEM "file:///...">`, or SSRF via an `http://`
  SYSTEM identifier). `packages/core/src/walkers/xml.ts` configures `fast-xml-parser` with
  `processEntities: true`, which resolves the five predefined XML entities and inline/internal
  entity declarations — but fast-xml-parser has no DOCTYPE/external-subset resolver at all: it
  cannot fetch a `SYSTEM` or `PUBLIC` external entity over the filesystem or network. That
  makes classic XXE not applicable here by library construction, not by paste7-side
  filtering — worth flagging because that distinction matters if the XML parser is ever
  swapped. **Residual risk, not independently verified in this pass**: entity-expansion
  ("billion laughs") DoS via deeply nested internal entity self-reference. No fixture test
  currently exercises this; low severity (a hung/slow tab, not a data-exposure issue) but cheap
  to add as a property-test case alongside the existing fast-check suite.
- **JSON prototype pollution** — `JSON.parse` itself is not vulnerable (unlike
  `JSON.parse` + unsafe merge helpers). The FHIR JSON walker doesn't do a recursive
  object-spread merge of parsed input into a shared object, so `__proto__`/`constructor`-key
  poisoning isn't a live path today. Worth re-checking if the walker ever grows a generic
  "merge patch" feature.
- **Parser DoS via pathological input** (huge single paste, deeply nested HL7 repetition
  fields, deeply nested XML/JSON) — no explicit input-size cap in the Scratchpad today. A
  multi-hundred-MB paste would debounce, then block the render thread doing
  `engine.redact()` synchronously-ish (it's `async` per the API but the internals are CPU-bound
  per `engine-contract.md` §2). Impact is a frozen/slow UI, not data exposure. Low priority
  given the realistic input size (a single interop message, not a bulk export) but worth a
  soft length guard in the Scratchpad input handler if this ever gets external users pasting
  arbitrary clipboard content.
- **Rendering the redacted/original text** — Monaco renders as plain text in a code editor,
  not as HTML; there's no `dangerouslySetInnerHTML`-style sink for pasted content anywhere in
  `scratchpad/**`. Findings panel and token tree render structured data through React, which
  escapes by default. No stored/reflected XSS path found in this pass.

### 3.2 DICOM file input → dcmjs (DICOM SR)

Untrusted binary files (real PHI-bearing DICOM exports, or files that merely claim to be
DICOM) reach `dcmjs`'s Part 10 parser.

- **Malformed/adversarial DICOM parsing** — `dcmjs` is a JS library (memory-safe language;
  no buffer-overflow class of bug like a native DICOM toolkit would carry), but it can still
  throw on malformed input, and pathological files (huge declared element lengths, deeply
  nested implicit sequences) are a plausible DoS vector (excessive allocation / long parse
  loop) more than a memory-corruption one. `redactor.ts` wraps the parse call and propagates
  errors as a rejected promise → `DicomView` renders a `state: "error"` card
  (`Could not load DICOM file`), so a parse failure degrades gracefully in the UI *when it's an
  async rejection*. See §5 for the one path found in this session where a **synchronous** throw
  during a `useEffect` bypasses that graceful handling entirely.
- **Non-SR DICOM rejected before redaction** — `isSrSopClass()` gate runs before any header is
  touched; this is a scope control (SR-only, per the 2026-05-01 rescope), not really a security
  control, but it does mean a CT/MR/US file dropped by mistake gets rejected rather than
  partially processed with an SR-tuned rule pack that wouldn't know its PHI-bearing fields.
- **ContentSequence / AcquisitionContext preserved verbatim** — `(0040,A730)` and `(0040,0555)`
  are explicitly out of the SR rule pack's scope (documented in `redactor.ts`). This is a
  **known, accepted gap, not a bug**: SR narrative content can carry embedded PHI in free text
  that this redactor does not touch. The DICOM drop-zone copy already says "SR headers
  only... ContentSequence preserved verbatim" — the UI discloses this; worth keeping that
  disclosure visible (it currently only appears in the empty-state copy, not in the `ReadyView`
  after a file loads — a user who drops a file and doesn't see the initial empty state won't
  see the caveat again in-session).

### 3.3 Tauri IPC surface (`invoke()` boundary)

Four commands, all reachable by any JS running in the `main` window: `ping`, `read_text_file`,
`read_dicom_file`, `write_redacted_dicom`.

- **`write_redacted_dicom` is well-scoped**: destination is derived server-side from the
  source path (stem + `.redacted.dcm`), double-checked to end in that suffix before writing.
  JS supplies a source path and bytes; it cannot choose an arbitrary destination. This is
  documented in HANDOFF.md as a three-layer trust boundary and holds up on inspection.
- **`read_text_file` / `read_dicom_file` are *not* scoped to a user-picked path** — they
  require an absolute path and (for the DICOM one) a `.dcm` extension, but neither command
  verifies the path actually came from a dialog selection or a drag-drop event the user
  performed. Any JS with IPC access — the app's own frontend today, but also anything that
  ever got script execution in the webview (compromised dependency, or a future regression
  that renders untrusted content unsafely) — can call
  `invoke("read_dicom_file", { path: "C:\\Users\\...\\anything.dcm" })` for **any** `.dcm` file
  readable by the OS user, not just one the user explicitly opened. Rust-side comments in
  `lib.rs` acknowledge this ("Caller-side restriction: the frontend only invokes this for
  paths the user picked") but that's a frontend convention, not an enforced boundary — the
  Rust command trusts the JS caller. Given the current threat model (no network, no XSS sink
  found, single-user desktop app) this is low-severity today, but it's exactly the kind of gap
  that `capabilities/default.json` splitting (Phase 4 deliverable, next in this session) should
  narrow: a `fs:default` grant plus un-scoped custom commands is broader than the two concrete
  read operations the app actually needs.
- **`fs:default` capability is unused by the app's own code** — the app never calls
  `@tauri-apps/plugin-fs`'s JS API directly (grepped; zero hits). All file I/O goes through the
  three custom Rust commands. The `fs:default` permission in `capabilities/default.json` is
  therefore dead grant: if anything in the webview ever got arbitrary JS execution, it would
  have access to the full `plugin-fs` JS surface (subject to the plugin's own scope rules,
  which are not further restricted in this capabilities file) for no functional benefit to the
  app. This is the single highest-value finding motivating the capability split (§7 / Phase 4
  step 2 of this session).
- **`shell:allow-open`** is present and unused by any source file (grepped `shell` /
  `@tauri-apps/plugin-shell` across `packages/app/src` — no hits). `shell:allow-open` only
  covers opening URLs/paths with the OS default handler (not arbitrary process execution), so
  the ceiling here is lower than `fs:default`, but it's still an unused grant.
- **`clipboard-manager:default`** is likewise unused: both Copy actions in the Scratchpad use
  `navigator.clipboard.writeText` (the browser API), not the Tauri clipboard plugin — documented
  already in HANDOFF.md as a deliberate choice ("no Tauri clipboard plugin needed because the
  writes happen in response to user button clicks"). The capability grant is nonetheless present
  and unused.
- **`dialog:default`** *is* used (`@tauri-apps/plugin-dialog`'s `open()` in `dicom-fs.ts`) —
  legitimately needed.

### 3.4 Clipboard

- **Copy-redacted (primary action)**: writes only redacted text. Matches the "PHI mode: ON"
  positioning — this is the safe default and it's the visually primary button
  (`copy-btn-primary`), per the Phase 2 "copy guards" work.
- **Copy-original (explicit secondary action)**: writes real PHI to the OS clipboard on
  purpose, when the user explicitly asks for it. This is an accepted, disclosed risk (the
  button is visually secondary, per HANDOFF's "copy guards" description), not a defect — any
  other app on the machine can subsequently read that clipboard content. Worth noting as a
  residual risk in this document rather than silently accepting it: the moment "copy original"
  is clicked, the trust boundary paste7 draws around PHI ends.

### 3.5 Settings persistence (Phase 4, not yet built)

Nothing exists yet — this session adds it (step 4). Threat: whatever gets persisted (window
layout, format-override preference, retain-profile defaults, etc.) must not include PHI, and
must not be readable/writable by another OS user account on a shared machine in plaintext.
DPAPI's `CRYPTPROTECT_UI_FORBIDDEN` + user-scope binding is the appropriate primitive here
because it ties the ciphertext to the Windows user account without requiring paste7 to manage
any key material itself — see §7.3.

### 3.6 Distribution / installer

- **Unsigned NSIS installer** (deferred 2026-05-01, tracked in
  `_areas/security/code-signing.md`) — a downloaded, unsigned installer gives Windows
  SmartScreen no publisher reputation to check, and gives a user no cryptographic way to verify
  the installer they ran is the one paste7's maintainer built, versus a tampered copy from a
  compromised GitHub Releases page, a malicious mirror, or a MITM'd download. This is a known,
  explicitly deferred risk (not re-litigated here — see workspace memory on code signing being
  parked pre-revenue). Documented here because a threat model should say it, not because this
  session is expected to fix it.
- **No auto-updater** — confirmed by absence of `tauri-plugin-updater` from `Cargo.toml` and
  no `updater` permission in capabilities. No update-channel supply-chain risk exists today
  because there is no update channel; each release is a fresh manual download. (This also means
  there's no forced-patching story — a known vulnerability in a bundled dependency stays live
  on a user's machine until they manually reinstall. Acceptable tradeoff for a pre-1.0 pilot,
  worth revisiting alongside the code-signing decision.)

## 4. Cross-cutting concerns

### 4.1 Supply chain

`@paste7/core` has three runtime dependencies (`dcmjs`, `fast-xml-parser`, `hl7-dictionary`).
The app package adds Monaco, the Tauri JS bindings, and font packages. Dependabot is configured
per workspace convention (weekly, npm ecosystem + github-actions). No further supply-chain
tooling (lockfile pinning beyond `package-lock.json`, SBOM generation, `npm audit` in CI) exists
today; reasonable for a pre-1.0 solo project, worth a follow-up once there's an install base to
protect.

### 4.2 Process isolation

Standard Tauri v2 architecture: a Rust host process plus a WebView2-hosted renderer. The
renderer is where all PHI processing (parsing, redaction, rendering) happens; the Rust side is
intentionally thin (three domain commands plus `ping`). This is good separation for the
*current* feature set — most of the actual parsing logic sits in the memory-safer language
(TypeScript/JS) rather than Rust, and the Rust surface that does exist is narrow enough to
audit in one sitting (confirmed in §3.3).

### 4.3 Content Security Policy

`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
asset:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost` — no
`unsafe-inline`/`unsafe-eval` for scripts, no wildcard `connect-src`. `style-src
'unsafe-inline'` is present (likely needed for Monaco's inline style injection) and is the one
loosened directive; it doesn't grant script execution on its own. This CSP is a real, already
good mitigation for the "what if a dependency or a crafted message got the renderer to execute
attacker script" scenario discussed in §2 and §3.1 — it wouldn't stop the script from running,
but it stops that script from exfiltrating anything over the network.

### 4.4 "Malicious message content" as an attack vector

Because paste7's entire purpose is processing content the user doesn't yet trust, it's worth
stating directly: no XSS sink was found in this review (§3.1), the XML parser doesn't resolve
external entities (§3.1), and even a hypothetical successful script-injection has no network
egress to abuse (§2, §4.3). The realistic failure mode for hostile input in this app is a
**parser crash or hang**, not data exfiltration — which is exactly the class of bug the
existing 251-test suite (property-based fast-check fixtures included) is built to catch. This
threat model doesn't identify a currently-exploitable content-driven vulnerability; it
identifies where the *ceiling* would be if one were found (no network egress, narrow IPC
surface once §7 lands).

## 5. Finding from this session's runtime smoke test

Testing the Phase 2/3 UI (browser-driven, against the same Vite-served frontend bundle the
Tauri shell loads) surfaced a real, reproducible crash: navigating to the DICOM SR view outside
an actual Tauri webview context throws synchronously and unmounts the entire React tree (no
error boundary exists anywhere in the app — confirmed by React's own dev-mode warning: "Consider
adding an error boundary to your tree").

**Root cause, confirmed by reading `node_modules/@tauri-apps/api/webview.js`**: `DicomView`'s
mount-time `useEffect` calls `getCurrentWebview()` synchronously
(`packages/app/src/dicom/DicomView.tsx:41`), which directly dereferences
`window.__TAURI_INTERNALS__.metadata.currentWebview.label` with no guard. Inside the real
`paste7-shell.exe` window, `__TAURI_INTERNALS__` is injected before any page script runs, so
this never throws there — **this is not a defect that reaches end users of the actual desktop
app**, and it does not block the Phase 2/3 runtime smoke test (the native window launched,
stayed up, and rendered the Scratchpad view correctly; see the session's commit/verification
notes). It only reproduces when the identical frontend bundle is loaded in a context without
Tauri's injected globals, which is exactly the gap a browser-based UI test has and a native
Tauri launch doesn't.

It's included here, not fixed, because it's genuinely threat-model-relevant even though it
isn't reachable today: **there is no error boundary anywhere in the app.** Any *future*
uncaught render exception — in Scratchpad or DICOM, triggered by some input this session's
tests didn't cover — has the same blast radius: the whole webview goes blank, mid-processing
PHI is still sitting in renderer memory, and if Windows Error Reporting is enabled and captures
a crash dump of the WebView2 renderer process at that moment, that dump could persist PHI to
disk outside paste7's control and outside its "in-memory only" guarantee. This is **not
independently verified** in this session (would require deliberately crashing WebView2 and
inspecting WER behavior) — flagged as a plausible residual risk, not a confirmed one. An error
boundary around the two workflow views would not close this gap by itself (React error
boundaries don't stop the renderer process from having had the data in memory), but it would
stop an unrelated bug in one view from taking down the whole app, which is worth doing
independently of this threat model. Not in scope for this session's four deliverables; noted
here so it doesn't get lost, and recorded as a Kanban backlog item.

## 6. Explicitly out of scope

Matches the product's own non-goals (CLAUDE.md, PLAN.md) — restated here as threat-model
boundaries, not repeated as product scope:

- Network-based adversaries (no network capability exists to attack).
- A malicious or compromised local Windows account with code-execution as the same user
  (standard OS trust boundary; no desktop app defends against this).
- DICOM pixel-data redaction, non-SR DICOM, SCP listeners, X12/NCPDP, free-text clinical
  narrative auto-scrubbing — all explicit product non-goals; not attack surface because the
  functionality doesn't exist.
- Formal compliance guarantees (HIPAA, GDPR, etc.) — operational property of deployment, not a
  code-level claim this document or the app makes.
- Physical access / device theft — no at-rest encryption of the installed app itself; DPAPI
  (§7.3) protects the one piece of persisted state (settings) this app will have, tied to the
  Windows user account, not full-disk encryption.

## 7. Anticipated future surface (not yet built)

Recorded so the next phase that touches these doesn't have to rediscover the shape of the
problem.

- **Phase 6 (OCR ingest)**: adds a new untrusted-input surface — pasted/dropped **images**
  (screenshots of third-party HL7 viewers) fed to `Windows.Media.Ocr`. New considerations then:
  image parsing (Windows OS-level codec surface, not paste7 code, but still a new input type
  reaching the process), OCR'd text quality/normalization before it reaches the existing HL7 v2
  walker (already scoped as a separate preprocessing module per `engine-contract.md` §15), and
  whether the image itself needs the same "never touches disk" guarantee the text workflows
  have (PLAN.md already frames this as image-in/text-out, no image-output workflow — worth
  confirming the image bytes don't get incidentally cached anywhere, e.g. a Tauri image-preview
  temp file, when that phase is built).
- **Phase 7 (local MCP server)**: adds a new trust boundary — a stdio JSON-RPC surface that
  hands `@paste7/core`'s redaction primitives to *any local process that can spawn the MCP
  binary and speak the protocol*, not just paste7's own UI. That's a meaningfully different
  threat model from "one interactive user driving one GUI": it's "any local agent/tool with
  filesystem access to spawn a child process." Framing already correctly lands on "PHI
  redaction primitives," not a compliance claim (per HANDOFF's decision log) — when this phase
  is designed, its own threat-model section should cover argument/stdio input validation
  separately from this document, since the caller is no longer a human clicking through a GUI.

## 8. What Phase 4's remaining steps close (traceability)

This document is deliverable 1 of Phase 4. The findings above motivate the other three:

| Finding | Closed by |
|---|---|
| §3.3 — `fs:default`, `shell:allow-open`, `clipboard-manager:default` all granted but unused by app code; `read_text_file`/`read_dicom_file` reachable by any IPC-capable JS with no path scoping | Per-workflow capability split (this session's step 2 of 4 remaining) |
| §3.5 — settings persistence doesn't exist yet and needs to land encrypted, user-scoped, without paste7 managing key material | DPAPI-encrypted settings (this session's step 3 of 4 remaining) |
| General — nothing today prevents a future code change from accidentally `console.log`-ing or serializing a secret value (settings almost certainly won't hold PHI, but *could* hold something operator-sensitive later, e.g. a future opt-in path) | Branded `SecretValue` TS type (this session's step 4 of 4 remaining) |

§5's error-boundary gap and §3.1's entity-expansion test gap are **not** closed by this
session's four steps — recorded in `_meta/Kanban.md` backlog for future pickup.
