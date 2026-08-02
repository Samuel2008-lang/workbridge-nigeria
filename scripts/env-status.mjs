#!/usr/bin/env node
/** Report which .env keys are set (lengths only, no secret values). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const e = {};
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!l || l.trim().startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    let v = l.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    e[l.slice(0, i).trim()] = v;
  }
}

const groups = {
  required_app: [
    "SUPABASE_PROJECT_ID",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PROJECT_ID",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ],
  schema_apply_one_of: [
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_ACCESS_TOKEN",
    "DATABASE_URL",
    "SUPABASE_DB_URL",
  ],
  edge_functions: ["SUPABASE_SERVICE_ROLE_KEY"],
  optional_app: ["VITE_APP_NAME", "VITE_FLUTTERWAVE_PUBLIC_KEY"],
};

for (const [group, keys] of Object.entries(groups)) {
  console.log(`\n[${group}]`);
  for (const k of keys) {
    const v = e[k];
    console.log(v ? `  ${k}=SET len=${v.length}` : `  ${k}=MISSING`);
  }
}

const appOk = groups.required_app.every((k) => e[k]);
const applyOk = groups.schema_apply_one_of.some((k) => e[k]);
console.log(`\n[summary] app_ready=${appOk} schema_apply_ready=${applyOk}`);
process.exit(appOk ? 0 : 1);
