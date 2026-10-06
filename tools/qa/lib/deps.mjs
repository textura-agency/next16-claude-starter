// The QA tools' dependencies live OUTSIDE the project, in a cache dir that
// `node tools/qa/setup.mjs` fills — the site gains no dependency, its lockfile
// never moves, and every project cut from this starter shares one install.
//
//   default: ~/.cache/next16-qa        override: NEXT16_QA_CACHE=/some/dir
//
// Every tool resolves its packages from there with createRequire (the same
// pattern the probes this was ported from used to borrow another folder's
// node_modules).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CACHE_DIR = process.env.NEXT16_QA_CACHE || join(homedir(), ".cache", "next16-qa");
export const PACKAGES = {
  lighthouse: "^12.8.0",
  "puppeteer-core": "^24.43.0",
  "chrome-launcher": "^1.2.0",
  "axe-core": "^4.13.0",
  playwright: "^1.62.0",
  pngjs: "^7.0.0",
};

const req = createRequire(join(CACHE_DIR, "package.json"));

function missing(name, why) {
  console.error(`✖ ${name} is not installed in the QA cache (${CACHE_DIR}).`);
  console.error(`  Run once:  node tools/qa/setup.mjs   (or: yarn qa:setup)`);
  if (why) console.error(`  (${why})`);
  process.exit(2);
}

/** Path of a file inside a cached package (e.g. "axe-core/axe.min.js"). */
export function resolvePath(spec) {
  if (!existsSync(join(CACHE_DIR, "package.json"))) missing(spec.split("/")[0]);
  try { return req.resolve(spec); } catch (e) { missing(spec.split("/")[0], e.code); }
}

export async function puppeteer() { return (await import(pathToFileURL(resolvePath("puppeteer-core")).href)).default; }
export async function lighthouse() { return (await import(pathToFileURL(resolvePath("lighthouse")).href)).default; }
export async function chromeLauncher() { return import(pathToFileURL(resolvePath("chrome-launcher")).href); }
export async function playwright() { const m = await import(pathToFileURL(resolvePath("playwright")).href); return m.default ?? m; }
export async function PNG() { return (await import(pathToFileURL(resolvePath("pngjs")).href)).PNG; }
