#!/usr/bin/env node
// One-time setup for tools/qa: installs Lighthouse, puppeteer-core,
// chrome-launcher, axe-core, Playwright (+ its WebKit build) and pngjs into a
// cache dir OUTSIDE the project. The site's package.json gains nothing.
//
//   node tools/qa/setup.mjs            # install / update
//   node tools/qa/setup.mjs --check    # report what is there, install nothing
//
// Cache: ~/.cache/next16-qa (override with NEXT16_QA_CACHE). Re-run any time;
// it is idempotent. Needs Google Chrome installed (the tools drive the real
// browser — never a bundled Chromium: GPU behaviour is the point).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, PACKAGES } from "./lib/deps.mjs";
import { chromePath } from "./lib/chrome.mjs";

const check = process.argv.includes("--check");
const pkgFile = join(CACHE_DIR, "package.json");

function installed() {
  return Object.fromEntries(Object.keys(PACKAGES).map((name) => {
    try { return [name, JSON.parse(readFileSync(join(CACHE_DIR, "node_modules", name, "package.json"), "utf8")).version]; }
    catch { return [name, null]; }
  }));
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) { console.error(`✖ Node ${process.version}: the QA tools need Node ≥ 20 (use the project's .nvmrc).`); process.exit(1); }

const before = installed();
if (check) {
  console.log(`QA cache: ${CACHE_DIR}`);
  for (const [n, v] of Object.entries(before)) console.log(`  ${v ? "✔" : "✖"} ${n}${v ? " " + v : " — missing"}`);
  console.log(`  ${chromePath() ? "✔" : "✖"} Google Chrome ${chromePath() || "— not found (set CHROME_PATH)"}`);
  process.exit(Object.values(before).every(Boolean) && chromePath() ? 0 : 1);
}

mkdirSync(CACHE_DIR, { recursive: true });
if (!existsSync(pkgFile)) writeFileSync(pkgFile, JSON.stringify({ name: "next16-qa-cache", private: true, description: "Dependencies of tools/qa — installed by tools/qa/setup.mjs. Not a project." }, null, 2) + "\n");

const specs = Object.entries(PACKAGES).map(([n, v]) => `${n}@${v}`);
console.log(`▸ installing into ${CACHE_DIR}\n  ${specs.join(" ")}`);
// npm, not yarn: the cache is not a workspace and must not inherit the project's resolver.
execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", "--prefix", CACHE_DIR, ...specs], { stdio: "inherit" });

// Playwright's WebKit build (for webkit-probe.mjs). Chrome is NOT downloaded:
// every Chrome tool drives the installed Google Chrome.
console.log("▸ installing Playwright WebKit");
execFileSync(process.execPath, [join(CACHE_DIR, "node_modules", "playwright", "cli.js"), "install", "webkit"], { stdio: "inherit" });

const after = installed();
console.log("\n✔ QA cache ready:");
for (const [n, v] of Object.entries(after)) console.log(`  ${n.padEnd(16)} ${v}${before[n] && before[n] !== v ? `  (was ${before[n]})` : ""}`);
const chrome = chromePath();
console.log(chrome ? `  Google Chrome    ${chrome}` : "  ! Google Chrome not found — install it or set CHROME_PATH");
console.log("\nNext: `next build && next start -p 4500`, then e.g. `node tools/qa/lighthouse.mjs --url http://localhost:4500/` — see tools/qa/README.md");
