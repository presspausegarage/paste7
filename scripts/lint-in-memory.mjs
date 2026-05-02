#!/usr/bin/env node
// In-memory invariant lint for paste7. Fails CI if any code under
// `packages/app/src/scratchpad/**` references an API that could move
// pasted content to a persistent surface (disk, browser storage, etc.).
//
// Per PLAN.md: scratchpad pastes never touch disk. The only sanctioned
// disk artifacts in the app are settings (DPAPI-encrypted, no message
// content) and DICOM SR redacted exports (Phase 3, in `dicom/**`).
//
// Phase 6 will extend this to `ocr/**` with similar rules.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const SHARED_DISK_WRITE_PATTERNS = [
  { pattern: /\bwriteTextFile\b/, why: "@tauri-apps/plugin-fs file write" },
  { pattern: /\bwriteFile\b/, why: "node:fs file write" },
  { pattern: /\bwriteBinaryFile\b/, why: "@tauri-apps/plugin-fs binary write" },
  { pattern: /\blocalStorage\b/, why: "browser localStorage persistence" },
  { pattern: /\bsessionStorage\b/, why: "browser sessionStorage persistence" },
  { pattern: /\bindexedDB\b/, why: "browser IndexedDB persistence" },
  { pattern: /["']@tauri-apps\/plugin-fs["']/, why: "tauri fs plugin import" },
];

const TARGETS = [
  {
    dir: "packages/app/src/scratchpad",
    label: "scratchpad",
    forbidden: SHARED_DISK_WRITE_PATTERNS,
  },
  {
    // DICOM exports are allowed but only via the Rust `write_redacted_dicom`
    // Tauri command, which derives the destination path itself and enforces
    // the `.redacted.dcm` suffix. Direct write APIs from JS are still blocked
    // — the same forbidden-pattern list applies. The scoped Tauri command
    // shows up as `invoke("write_redacted_dicom", ...)` and is invisible to
    // these patterns by design.
    dir: "packages/app/src/dicom",
    label: "dicom",
    forbidden: SHARED_DISK_WRITE_PATTERNS,
  },
];

const FILE_EXTS = new Set([".ts", ".tsx"]);

function* walkSourceFiles(rootDir) {
  let entries;
  try {
    entries = readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(rootDir, e.name);
    if (e.isDirectory()) {
      yield* walkSourceFiles(full);
    } else if (e.isFile()) {
      const dot = e.name.lastIndexOf(".");
      if (dot >= 0 && FILE_EXTS.has(e.name.slice(dot))) {
        yield full;
      }
    }
  }
}

function lintTarget(target) {
  const violations = [];
  const absDir = join(REPO_ROOT, target.dir);
  try {
    statSync(absDir);
  } catch {
    return violations;
  }
  for (const file of walkSourceFiles(absDir)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of target.forbidden) {
        if (rule.pattern.test(line)) {
          violations.push({
            target: target.label,
            file: relative(REPO_ROOT, file).split(sep).join("/"),
            line: i + 1,
            text: line.trim(),
            why: rule.why,
          });
        }
      }
    }
  }
  return violations;
}

const allViolations = TARGETS.flatMap(lintTarget);

if (allViolations.length === 0) {
  console.log(`in-memory lint: ${TARGETS.map((t) => t.label).join(", ")} clean`);
  process.exit(0);
}

console.error(`in-memory lint: ${allViolations.length} violation(s)`);
for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line}  [${v.target}]  ${v.why}`);
  console.error(`    ${v.text}`);
}
process.exit(1);
