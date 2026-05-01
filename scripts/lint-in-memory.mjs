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

const TARGETS = [
  {
    dir: "packages/app/src/scratchpad",
    label: "scratchpad",
    forbidden: [
      { pattern: /\bwriteTextFile\b/, why: "@tauri-apps/plugin-fs file write" },
      { pattern: /\bwriteFile\b/, why: "node:fs file write" },
      { pattern: /\bwriteBinaryFile\b/, why: "@tauri-apps/plugin-fs binary write" },
      { pattern: /\blocalStorage\b/, why: "browser localStorage persistence" },
      { pattern: /\bsessionStorage\b/, why: "browser sessionStorage persistence" },
      { pattern: /\bindexedDB\b/, why: "browser IndexedDB persistence" },
      { pattern: /["']@tauri-apps\/plugin-fs["']/, why: "tauri fs plugin import" },
    ],
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
