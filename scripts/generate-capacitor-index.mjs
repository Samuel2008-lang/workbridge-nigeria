#!/usr/bin/env node
/**
 * After `vite build`, generate a Capacitor-ready index.html in the public output.
 *
 * TanStack Start + Nitro produce hashed JS/CSS under .output/public/assets/ and an
 * SSR server under .output/server, but no static index.html. Capacitor requires one.
 *
 * We read the TanStack Start route manifest (server) for the root entry script,
 * fall back to scanning assets/, and write a SPA shell that the custom client
 * entry mounts with createRoot when data-capacitor-shell="true".
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, ".output", "public");
const serverDir = path.join(root, ".output", "server");
const assetsDir = path.join(publicDir, "assets");

function fail(msg) {
  console.error(`[generate-capacitor-index] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(publicDir)) {
  fail(`Missing ${publicDir}. Run "npm run build" first.`);
}

function findEntryFromManifest() {
  if (!fs.existsSync(serverDir)) return null;
  const files = fs.readdirSync(serverDir);
  const manifest = files.find((f) => f.includes("tanstack-start-manifest") && f.endsWith(".mjs"));
  if (!manifest) return null;
  const src = fs.readFileSync(path.join(serverDir, manifest), "utf8");
  // scripts: [{ attrs: { type: "module", async: true, src: "/assets/index-XXXX.js" } }]
  const m = src.match(/src:\s*"(\/assets\/index-[^"]+\.js)"/);
  return m?.[1] ?? null;
}

function findLargestIndexJs() {
  if (!fs.existsSync(assetsDir)) return null;
  const files = fs
    .readdirSync(assetsDir)
    .filter((f) => /^index-.*\.js$/.test(f))
    .map((f) => ({
      f,
      size: fs.statSync(path.join(assetsDir, f)).size,
    }))
    .sort((a, b) => b.size - a.size);
  return files[0] ? `/assets/${files[0].f}` : null;
}

function findCss() {
  if (!fs.existsSync(assetsDir)) return null;
  const css = fs.readdirSync(assetsDir).find((f) => f.endsWith(".css"));
  return css ? `/assets/${css}` : null;
}

const entryScript = findEntryFromManifest() || findLargestIndexJs();
const cssHref = findCss();

if (!entryScript) {
  fail("Could not locate client entry script in .output/public/assets.");
}

const html = `<!DOCTYPE html>
<html lang="en" data-capacitor-shell="true">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <meta name="theme-color" content="#0F4A32" />
    <meta
      name="description"
      content="Connect with people who need work done, or earn money doing physical and digital jobs across Nigeria."
    />
    <title>WorkBridge — Nigeria's job marketplace</title>
    <link rel="icon" type="image/png" href="/workbridge-logo.png" />
    <link rel="apple-touch-icon" href="/workbridge-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap"
    />
    ${cssHref ? `<link rel="stylesheet" href="${cssHref}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entryScript}"></script>
  </body>
</html>
`;

const outPath = path.join(publicDir, "index.html");
fs.writeFileSync(outPath, html, "utf8");
console.log(`[generate-capacitor-index] Wrote ${outPath}`);
console.log(`[generate-capacitor-index] entry=${entryScript} css=${cssHref ?? "(none)"}`);
