#!/usr/bin/env node
/**
 * Strip surrounding quotes from .env values (common when pasting from dashboards).
 * Does not print secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

if (!fs.existsSync(envPath)) {
  console.error("[fix-env-quotes] No .env file found");
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
let changed = 0;
const fixed = raw.split(/\r?\n/).map((line) => {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) return line;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1);
    changed += 1;
  }
  return `${k}=${v}`;
});

fs.writeFileSync(envPath, fixed.join("\n"), "utf8");
console.log(`[fix-env-quotes] Stripped quotes from ${changed} value(s)`);
