#!/usr/bin/env node
// Syncs the version string across every version-bearing file in the workspace:
// root/core/app package.json, Cargo.toml, and tauri.conf.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: node scripts/bump-version.mjs <semver>  (e.g. 0.1.0 or 0.1.0-alpha.1)");
  process.exit(1);
}

// Regex replacement (not parse+stringify) so untouched formatting — array
// compactness, key order, indentation — is left exactly as-is in the diff.
function replaceVersionField(absPath, pattern) {
  const original = readFileSync(absPath, "utf8");
  const updated = original.replace(pattern, `$1${version}$2`);
  if (updated === original) {
    console.error(`Failed to update ${absPath} — version pattern did not match.`);
    process.exit(1);
  }
  writeFileSync(absPath, updated);
  console.log(`updated ${path.relative(repoRoot, absPath)} -> ${version}`);
}

const packageJsonPaths = [
  "package.json",
  "packages/core/package.json",
  "packages/app/package.json",
];
for (const relPath of packageJsonPaths) {
  replaceVersionField(path.join(repoRoot, relPath), /("version":\s*")[^"]*(")/);
}

replaceVersionField(
  path.join(repoRoot, "packages/app/src-tauri/Cargo.toml"),
  /(^\[package\][\s\S]*?^version = ")[^"]*(")/m
);

replaceVersionField(
  path.join(repoRoot, "packages/app/src-tauri/tauri.conf.json"),
  /("version":\s*")[^"]*(")/
);
