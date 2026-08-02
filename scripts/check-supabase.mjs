#!/usr/bin/env node
/**
 * Verify Supabase connectivity using .env (no secrets printed).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

function loadEnv() {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const env = loadEnv();
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key =
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY;
const projectId = env.SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID;

if (!url || !key) {
  console.error("[check-supabase] Missing SUPABASE_URL or publishable key in .env");
  process.exit(1);
}

let host;
try {
  host = new URL(url).host;
} catch {
  console.error("[check-supabase] Invalid SUPABASE_URL (check for quotes/spaces)");
  process.exit(1);
}

const refFromUrl = host.split(".")[0];
console.log(`[check-supabase] host=${host}`);
console.log(`[check-supabase] project_id_set=${Boolean(projectId)}`);
console.log(
  `[check-supabase] project_id_matches_url=${projectId ? projectId === refFromUrl : "n/a"}`,
);

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const auth = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
console.log(`[check-supabase] auth_health=${auth.status}`);

const profiles = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
  headers,
});
const profilesBody = await profiles.text();
console.log(`[check-supabase] profiles=${profiles.status}`);
if (profiles.status !== 200) {
  console.log(
    `[check-supabase] profiles_hint=${profilesBody.slice(0, 160).replace(/\s+/g, " ")}`,
  );
}

const jobs = await fetch(`${url}/rest/v1/jobs?select=id&limit=1`, { headers });
console.log(`[check-supabase] jobs=${jobs.status}`);

const settings = await fetch(`${url}/rest/v1/user_settings?select=user_id&limit=1`, {
  headers,
});
console.log(`[check-supabase] user_settings=${settings.status}`);

const ok =
  auth.status === 200 &&
  profiles.status === 200 &&
  jobs.status === 200 &&
  settings.status === 200;

process.exit(ok ? 0 : 2);
