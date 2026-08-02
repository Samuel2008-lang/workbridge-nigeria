#!/usr/bin/env node
/**
 * Apply WorkBridge bootstrap SQL to the configured Supabase project.
 *
 * Credentials (first match wins), never printed:
 *  1. DATABASE_URL / SUPABASE_DB_URL
 *  2. SUPABASE_DB_PASSWORD (+ project ref from SUPABASE_URL)
 *  3. SUPABASE_ACCESS_TOKEN (Management API SQL)
 *  4. SUPABASE_SERVICE_ROLE_KEY cannot run raw DDL via PostgREST — not used for apply
 *
 * Usage: node scripts/apply-supabase-schema.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260726000000_workbridge_fresh_bootstrap.sql",
);

function loadEnv() {
  const out = { ...process.env };
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    const k = line.slice(0, i).trim();
    if (!(k in out) || !out[k]) out[k] = v;
  }
  return out;
}

function projectRef(env) {
  const id = env.SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID;
  if (id) return id;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host.split(".")[0];
  } catch {
    return null;
  }
}

const env = loadEnv();
if (!fs.existsSync(sqlPath)) {
  console.error("[apply-schema] Missing bootstrap SQL:", sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, "utf8");
const ref = projectRef(env);
console.log(`[apply-schema] project_ref=${ref || "(unknown)"}`);
console.log(`[apply-schema] sql_bytes=${sql.length}`);

async function viaManagementApi() {
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token || !ref) return false;
  console.log("[apply-schema] Trying Management API…");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  console.log(`[apply-schema] management_api_status=${res.status}`);
  if (!res.ok) {
    console.error("[apply-schema] management_api_error:", text.slice(0, 400));
    return false;
  }
  console.log("[apply-schema] Applied via Management API");
  return true;
}

function buildDbUrl() {
  let dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;
  const password = env.SUPABASE_DB_PASSWORD || env.DB_PASSWORD;
  if (!dbUrl && password && ref) {
    const encoded = encodeURIComponent(password);
    // Prefer pooler-style when only password is known; direct host also tried by callers
    dbUrl = `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
  }
  return { dbUrl, password: env.SUPABASE_DB_PASSWORD || env.DB_PASSWORD || "" };
}

async function viaNodePg() {
  const { dbUrl, password } = buildDbUrl();
  if (!dbUrl) return false;
  let Client;
  try {
    ({ Client } = await import("pg"));
  } catch {
    console.log("[apply-schema] pg package not installed; trying system psql…");
    return false;
  }
  console.log("[apply-schema] Trying node-postgres…");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log("[apply-schema] Applied via node-postgres");
    return true;
  } catch (err) {
    console.error(
      "[apply-schema] node-postgres failed:",
      String(err?.message || err).slice(0, 400),
    );
    // Retry with pooler host if direct failed and we only have password
    if (password && ref && dbUrl.includes(`db.${ref}.supabase.co`)) {
      const encoded = encodeURIComponent(password);
      const pooler = `postgresql://postgres.${ref}:${encoded}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
      const c2 = new Client({
        connectionString: pooler,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
      });
      try {
        await c2.connect();
        await c2.query(sql);
        console.log("[apply-schema] Applied via node-postgres (pooler)");
        await c2.end().catch(() => {});
        return true;
      } catch (err2) {
        console.error(
          "[apply-schema] pooler failed:",
          String(err2?.message || err2).slice(0, 300),
        );
        await c2.end().catch(() => {});
      }
    }
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function viaPsql() {
  const { dbUrl, password } = buildDbUrl();
  if (!dbUrl) return false;

  console.log("[apply-schema] Trying psql…");
  const tmp = path.join(root, ".tmp-bootstrap.sql");
  fs.writeFileSync(tmp, sql, "utf8");
  const result = spawnSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", tmp],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: password || "" } },
  );
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (result.error) {
    console.log("[apply-schema] psql not available:", result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.error(
      "[apply-schema] psql failed:",
      (result.stderr || result.stdout || "").slice(0, 500),
    );
    return false;
  }
  console.log("[apply-schema] Applied via psql");
  return true;
}

async function viaPgMeta() {
  // Some projects expose SQL through service role on /pg/query (not standard public)
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (!url || !service) return false;
  console.log("[apply-schema] Trying service-role pg endpoint…");
  const endpoints = [
    `${url}/pg/query`,
    `${url}/rest/v1/rpc/exec_sql`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      console.log(`[apply-schema] ${ep} status=${res.status}`);
      if (res.ok) {
        console.log("[apply-schema] Applied via service-role endpoint");
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

const ok =
  (await viaManagementApi()) ||
  (await viaNodePg()) ||
  viaPsql() ||
  (await viaPgMeta());

if (!ok) {
  console.error(`
[apply-schema] Could not apply SQL automatically.

Add ONE of these to .env (do not commit secrets), then re-run:
  SUPABASE_DB_PASSWORD=<database password from Project Settings → Database>
  SUPABASE_ACCESS_TOKEN=<personal access token from supabase.com/dashboard/account/tokens>
  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-....pooler.supabase.com:6543/postgres

Or paste this file in Supabase Dashboard → SQL Editor → Run:
  supabase/migrations/20260726000000_workbridge_fresh_bootstrap.sql
  (also copied to supabase/FRESH_PROJECT_BOOTSTRAP.sql)
`);
  process.exit(2);
}

console.log("[apply-schema] Done");
