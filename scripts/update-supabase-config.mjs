#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  env[line.slice(0, i).trim()] = v;
}
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ref =
  env.SUPABASE_PROJECT_ID ||
  env.VITE_SUPABASE_PROJECT_ID ||
  new URL(url).host.split(".")[0];

const toml = `project_id = "${ref}"

[functions.flutterwave-webhook]
verify_jwt = false
`;
fs.writeFileSync(path.join(root, "supabase", "config.toml"), toml);
console.log(`[update-supabase-config] project_id=${ref}`);

const bootstrap = path.join(
  root,
  "supabase",
  "migrations",
  "20260726000000_workbridge_fresh_bootstrap.sql",
);
for (const name of ["FRESH_PROJECT_BOOTSTRAP.sql", "APPLY_THIS_IN_SUPABASE_SQL_EDITOR.sql"]) {
  fs.copyFileSync(bootstrap, path.join(root, "supabase", name));
}
console.log("[update-supabase-config] bootstrap copies refreshed");
