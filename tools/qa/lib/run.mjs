// The frame every QA tool shares: arguments, the report folder, the target
// sanity checks, the load-average note and the verdict → exit code.
//
// Output: reports/qa/<tool>/<stamp>/ at the project root (gitignored) —
// result.json plus whatever the tool shoots — and a plain-language summary on
// stdout. Exit 0 = pass, 1 = the verdict failed, 2 = the tool could not run.
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadavg } from "node:os";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
export const median = (xs) => { const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
export const round = (x, d = 1) => (x == null ? null : +Number(x).toFixed(d));

/**
 * Parse a tool's CLI. `options` extend the shared ones (--url, --out, --help).
 * `usage` is printed on --help or a missing --url.
 */
export function cli(tool, usage, options = {}, { needUrl = true } = {}) {
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: { url: { type: "string" }, out: { type: "string" }, help: { type: "boolean", short: "h" }, ...options } });
  } catch (e) { console.error(`✖ ${e.message}\n\n${usage}`); process.exit(2); }
  const o = parsed.values;
  // A bare URL as the first positional is accepted too.
  if (!o.url && parsed.positionals[0] && /^https?:\/\//.test(parsed.positionals[0])) o.url = parsed.positionals[0];
  if (o.help || (needUrl && !o.url)) { console.log(usage); process.exit(o.help ? 0 : 2); }
  if (o.url && !/^https?:\/\//.test(o.url)) { console.error(`✖ --url must be http(s)://… (got "${o.url}")`); process.exit(2); }
  const outDir = o.out ? resolve(o.out) : join(PROJECT_ROOT, "reports", "qa", tool, stamp());
  mkdirSync(outDir, { recursive: true });
  return { o, positionals: parsed.positionals, outDir, rel: (p) => relative(process.cwd(), p) || "." };
}

/** Load average now; > 15 in any of the three = verdicts on this machine are unreliable. */
export function machineLoad() {
  const l = loadavg().map((x) => +x.toFixed(1));
  return { load: l, busy: l.some((x) => x > 15) };
}
export function warnIfBusy(log = console.log) {
  const m = machineLoad();
  if (m.busy) log(`  ! machine load ${m.load.join(" / ")} — above ~15 scroll and Lighthouse verdicts are unreliable here. Re-run in a quiet moment before acting on a regression.`);
  return m;
}

const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?\//.test(new URL(url).origin + "/");
export { isLocal };

/**
 * Is the URL answering, and is it a production build? `next dev` is never
 * measured: it ships unminified code, dev overlays and HMR, and (Next 16)
 * on 127.0.0.1 it may never hydrate at all (allowedDevOrigins).
 */
export async function checkTarget(url, { headers = {}, log = console.log } = {}) {
  let res, html = "";
  try {
    res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", ...headers }, redirect: "follow" });
    html = await res.text();
  } catch (e) {
    console.error(`✖ ${url} does not answer (${e.cause?.code || e.message}). Start the production build first:\n    next build && next start -p 4500`);
    process.exit(2);
  }
  if (res.status >= 400) log(`  ! ${url} answered ${res.status}${res.status === 401 || res.status === 403 ? " — a protected deployment? pass --header 'x-vercel-protection-bypass: <secret>'" : ""}`);
  const dev = /webpack-hmr|turbopack-hmr|__nextDevClientId|react-refresh|next-devtools|_next\/static\/development\//.test(html);
  if (dev) {
    console.error(`✖ ${url} looks like \`next dev\` (HMR / dev runtime in the HTML). Measure a production build: next build && next start -p 4500.\n  (--allow-dev overrides, for probes that only ask "does it break", never for numbers.)`);
    if (!process.argv.includes("--allow-dev")) process.exit(2);
  }
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "(no title)";
  // A shared machine's port can be someone else's server — say which page answered.
  log(`  target: ${url} → ${res.status} "${title.slice(0, 70)}"`);
  return { status: res.status, html, title, local: isLocal(url) };
}

/** Parse repeated --header "name: value" flags. */
export function headersFrom(list) {
  const out = {};
  for (const h of [].concat(list || [])) {
    const i = h.indexOf(":");
    if (i > 0) out[h.slice(0, i).trim()] = h.slice(i + 1).trim();
  }
  return out;
}

/** Write result.json, print the closing line, exit with the verdict. */
export function finish({ outDir, result, pass, summary, rel = (p) => p }) {
  writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(`\n${pass ? "PASS" : "FAIL"} — ${summary}`);
  console.log(`  report: ${rel(outDir)}`);
  process.exit(pass ? 0 : 1);
}
