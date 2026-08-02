#!/usr/bin/env node
/**
 * Fail fast after install if critical packages are incomplete.
 *
 * Nitro requires unenv's main entry (dist/index.mjs). A partial/corrupt
 * node_modules install can leave only dist/runtime and break the build.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`\n[verify-deps] ${msg}\n`);
  process.exit(1);
}

function resolvePkgRoot(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`));
  } catch {
    return path.join(root, "node_modules", name);
  }
}

const checks = [
  {
    name: "unenv",
    file: "dist/index.mjs",
    hint:
      "Nitro needs unenv/dist/index.mjs. Delete node_modules and reinstall: rm -rf node_modules && npm install",
  },
  {
    name: "@lovable.dev/vite-tanstack-config",
    file: "package.json",
    hint: "Required Vite/TanStack config package is missing. Run npm install.",
  },
  {
    name: "nitro",
    file: "package.json",
    hint: "Nitro is required for production builds. Run npm install.",
  },
];

for (const check of checks) {
  const pkgRoot = resolvePkgRoot(check.name);
  const target = path.join(pkgRoot, check.file);
  if (!fs.existsSync(target)) {
    fail(
      `Missing ${check.name}/${check.file.replace(/\\/g, "/")}.\n  ${check.hint}`,
    );
  }
}

console.log("[verify-deps] OK — unenv, nitro, and lovable config present");
