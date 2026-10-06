#!/usr/bin/env node
// Lighthouse, the way it can be believed: PC + mobile, median of ≥ 3 runs,
// all four categories, the per-run spread kept, the GPU on.
//
//   node tools/qa/lighthouse.mjs --url http://localhost:4500/
//   node tools/qa/lighthouse.mjs --url https://example.com/ --runs 5
//   node tools/qa/lighthouse.mjs --url … --devices mobile          # one profile (iterating)
//   node tools/qa/lighthouse.mjs --url … --as-bot                  # the robot form, as Googlebot gets it (src/proxy.ts)
//   node tools/qa/lighthouse.mjs --url … --as-bot --bot gptbot     # …as an AI crawler (or --bot pagespeed: PSI's Chrome-Lighthouse UA)
//   node tools/qa/lighthouse.mjs --url <candidate> --ab <reference> # interleaved A/B: A B A B …
//   node tools/qa/lighthouse.mjs --url … --header "x-vercel-protection-bypass: <secret>"
//
// Flags: --runs N (3) · --devices desktop,mobile[,tablet] · --min-perf 90 ·
//   --min-other 100 (Accessibility / Best Practices / SEO) · --timeout 180 (s per run)
//
// Verdict: every profile's MEDIAN performance ≥ --min-perf and the other three
// ≥ --min-other. Exit 1 otherwise. Full HTML reports per run in the report dir.
//
// Read it right:
//  - localhost LCP is not the site's LCP. Over HTTP/1.1 every early request
//    lands before first paint and Lantern bills them to LCP (~4–6 perf points
//    on asset-heavy pages) — or, the other way, no TTFB/CDN at all (one site:
//    4.8 s local vs 31 s hosted). Judge a local change by TBT; confirm load on
//    the real host.
//  - one run is an anecdote: identical runs swung LCP 2.7 → 4.6 s and CLS
//    0 → 0.18. A perf spread over ~8 points → re-run with --runs 5.
//  - the machine's load moves Lantern's TBT ~2×. Compare builds with --ab
//    (interleaved, same load), never a run today against a run yesterday.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, checkTarget, headersFrom, finish, median, machineLoad, warnIfBusy } from "./lib/run.mjs";
import { lighthouse as loadLighthouse, chromeLauncher } from "./lib/deps.mjs";
import { requireChrome, asLighthouseBot, orphanLighthouseChromes, UA } from "./lib/chrome.mjs";

const USAGE = `usage: node tools/qa/lighthouse.mjs --url <url> [--runs 3] [--devices desktop,mobile] [--as-bot] [--ab <reference-url>] [--header "k: v"] [--min-perf 90] [--min-other 100]`;
const { o, outDir, rel } = cli("lighthouse", USAGE, {
  runs: { type: "string", default: "3" }, devices: { type: "string", default: "desktop,mobile" },
  "as-bot": { type: "boolean" }, bot: { type: "string", default: "googlebot" }, ab: { type: "string" }, header: { type: "string", multiple: true },
  "min-perf": { type: "string", default: "90" }, "min-other": { type: "string", default: "100" },
  timeout: { type: "string", default: "180" }, "allow-dev": { type: "boolean" },
});

// The measurement config. Changing anything here makes before/after across
// the change meaningless — note it where the project keeps its decisions.
const MOBILE_UA = "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
// Lighthouse's own mobile numbers: slow 4G + 4× CPU (simulated).
const MOBILE_THROTTLING = { rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5, downloadThroughputKbps: 1638.4, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4 };
const DESKTOP_THROTTLING = { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 };
const PROFILES = {
  desktop: { formFactor: "desktop", screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, emulatedUserAgent: DESKTOP_UA, throttling: DESKTOP_THROTTLING },
  mobile: { formFactor: "mobile", screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }, emulatedUserAgent: MOBILE_UA, throttling: MOBILE_THROTTLING },
  tablet: { formFactor: "mobile", screenEmulation: { mobile: true, width: 768, height: 1024, deviceScaleFactor: 2, disabled: false }, emulatedUserAgent: MOBILE_UA, throttling: MOBILE_THROTTLING },
};
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
// No --disable-gpu: a software-GL fallback bills SwiftShader's cost to the page.
const CHROME_FLAGS = ["--headless=new", "--no-sandbox", "--hide-scrollbars", "--mute-audio"];

const runs = Number(o.runs);
const devices = o.devices.split(",").map((s) => s.trim()).filter(Boolean);
for (const d of devices) if (!PROFILES[d]) { console.error(`✖ unknown device "${d}" — one of ${Object.keys(PROFILES).join(", ")}`); process.exit(2); }
if (runs < 3) console.log(`  ! --runs ${runs}: fine for iterating, not a record — a verdict needs the median of ≥ 3`);
const headers = headersFrom(o.header);
const minPerf = Number(o["min-perf"]), minOther = Number(o["min-other"]);
const asBot = Boolean(o["as-bot"]);
// The robot form is decided by the UA (src/utils/bot-ua.ts). Googlebot and
// GPTBot are the crawlers that matter; "pagespeed" is what PSI sends.
const BOT_UAS = {
  googlebot: (d) => d === "desktop" ? "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/140.0.0.0 Safari/537.36" : UA.googlebot,
  gptbot: () => UA.gptbot,
  pagespeed: (d) => asLighthouseBot(PROFILES[d].emulatedUserAgent),
};
if (asBot && !BOT_UAS[o.bot]) { console.error(`✖ --bot must be one of ${Object.keys(BOT_UAS).join(", ")}`); process.exit(2); }

console.log(`▸ Lighthouse${asBot ? ` (robot form — ${o.bot} UA)` : ""} · ${devices.join(" + ")} × ${runs}${o.ab ? ` · interleaved A/B against ${o.ab}` : ""}`);
const target = await checkTarget(o.url, { headers });
if (o.ab) await checkTarget(o.ab, { headers });
const load0 = warnIfBusy();
const orphans = orphanLighthouseChromes();
if (orphans.length) console.log(`  ! ${orphans.length} Chrome(s) left by an earlier hung Lighthouse run are still alive (pids ${orphans.join(" ")}) — they steal CPU from this one: kill ${orphans.join(" ")}`);

const lighthouse = await loadLighthouse();
const { launch } = await chromeLauncher();
let chrome = null;
const startChrome = async () => { chrome = await launch({ chromePath: requireChrome(), chromeFlags: CHROME_FLAGS }); };
const stopChrome = async () => { try { await chrome?.kill(); } catch {} chrome = null; };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { await stopChrome(); process.exit(130); });

function summarise(lhr) {
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
  const num = (id) => lhr.audits[id]?.numericValue;
  const metrics = {
    FCP: Math.round(num("first-contentful-paint") ?? 0), LCP: Math.round(num("largest-contentful-paint") ?? 0),
    TBT: Math.round(num("total-blocking-time") ?? 0), CLS: +(num("cumulative-layout-shift") ?? 0).toFixed(3), SI: Math.round(num("speed-index") ?? 0),
  };
  const failing = [];
  for (const cat of CATEGORIES) for (const ref of lhr.categories[cat]?.auditRefs ?? []) {
    const a = lhr.audits[ref.id];
    if (!a || a.score === null || a.score >= 0.9 || ["notApplicable", "manual", "informative"].includes(a.scoreDisplayMode)) continue;
    failing.push({ cat, id: ref.id, title: a.title, weight: ref.weight, score: Math.round(a.score * 100), detail: a.displayValue || "" });
  }
  failing.sort((a, b) => b.weight - a.weight || a.score - b.score);
  const lcpEl = lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet;
  return { scores, metrics, failing, lcpElement: lcpEl?.slice(0, 140) || null, runtimeError: lhr.runtimeError?.code || null };
}

async function one(url, device, label) {
  const profile = asBot ? { ...PROFILES[device], emulatedUserAgent: BOT_UAS[o.bot](device) } : PROFILES[device];
  if (!chrome) await startChrome();
  const t = Number(o.timeout) * 1000;
  let timer;
  try {
    const res = await Promise.race([
      lighthouse(url, { port: chrome.port, output: "html", logLevel: "error" },
        { extends: "lighthouse:default", settings: { ...profile, onlyCategories: CATEGORIES, ...(Object.keys(headers).length ? { extraHeaders: headers } : {}) } }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`no result after ${o.timeout}s`)), t); }),
    ]);
    writeFileSync(join(outDir, `${label}.html`), res.report);
    writeFileSync(join(outDir, `${label}.json`), JSON.stringify(res.lhr));
    return { ...summarise(res.lhr), load: machineLoad().load[0], version: res.lhr.lighthouseVersion };
  } catch (e) {
    // A hung run leaves its Chrome behind: kill it here, never orphan it.
    console.log(`    ! ${label}: ${e.message} — Chrome killed, a fresh one for the next run`);
    await stopChrome();
    return null;
  } finally { clearTimeout(timer); }
}

function aggregate(samples) {
  const ok = samples.filter(Boolean);
  if (!ok.length) return null;
  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, median(ok.map((s) => s.scores[c]))]));
  const metrics = Object.fromEntries(Object.keys(ok[0].metrics).map((k) => [k, median(ok.map((s) => s.metrics[k]))]));
  const spread = Object.fromEntries([...CATEGORIES.map((c) => [c, ok.map((s) => s.scores[c])]), ...["LCP", "TBT", "CLS"].map((k) => [k, ok.map((s) => s.metrics[k])])]);
  // The failing list from the median-performance run — the most representative one.
  const rep = [...ok].sort((a, b) => a.scores.performance - b.scores.performance)[Math.floor(ok.length / 2)];
  return { runs: ok.length, scores, metrics, spread, failing: rep.failing.slice(0, 20), lcpElement: rep.lcpElement };
}

const line = (r) => `P ${r.scores.performance}  A ${r.scores.accessibility}  BP ${r.scores["best-practices"]}  SEO ${r.scores.seo}  │ LCP ${r.metrics.LCP}ms  TBT ${r.metrics.TBT}ms  CLS ${r.metrics.CLS}  SI ${r.metrics.SI}ms`;
const results = {}, reference = {};
try {
  for (const device of devices) {
    const A = [], B = [];
    for (let i = 0; i < runs; i++) {
      // Interleaved: the reference and the candidate share the same moment's load.
      if (o.ab) { const b = await one(o.ab, device, `${device}-ref-${i}`); B.push(b); if (b) console.log(`    ${device} ref  #${i + 1}  ${line(b)}  (load ${b.load})`); }
      const a = await one(o.url, device, `${device}-${i}`); A.push(a);
      if (a) console.log(`    ${device} ${o.ab ? "cand " : ""}#${i + 1}  ${line(a)}${a.runtimeError ? `  ! ${a.runtimeError}` : ""}  (load ${a.load})`);
    }
    results[device] = aggregate(A);
    if (o.ab) reference[device] = aggregate(B);
  }
} finally { await stopChrome(); }

console.log("");
let pass = true;
const notes = [];
for (const [d, r] of Object.entries(results)) {
  if (!r) { pass = false; console.log(`  ${d.padEnd(8)} no successful run`); continue; }
  const s = r.scores;
  const bad = [s.performance < minPerf && `performance ${s.performance} < ${minPerf}`, ...["accessibility", "best-practices", "seo"].filter((c) => s[c] < minOther).map((c) => `${c} ${s[c]} < ${minOther}`)].filter(Boolean);
  if (bad.length) pass = false;
  console.log(`  ${bad.length ? "✖" : "✔"} ${d.padEnd(8)} ${line(r)}   perf per run ${r.spread.performance.join(",")}`);
  if (r.lcpElement) console.log(`      LCP element: ${r.lcpElement}`);
  for (const f of r.failing.filter((f) => f.weight > 0).slice(0, 6)) console.log(`      ${f.cat.padEnd(14)} ${String(f.score).padStart(3)}  ${f.title}${f.detail ? ` — ${f.detail}` : ""}`);
  const sp = Math.max(...r.spread.performance) - Math.min(...r.spread.performance);
  if (sp > 8) notes.push(`${d}: performance spread ${sp} points across runs — re-run with --runs 5 before believing a change`);
  if (o.ab && reference[d]) {
    const q = reference[d];
    const dl = (k, unit = "") => `${k} ${q.metrics[k]}→${r.metrics[k]}${unit}`;
    console.log(`      A/B vs reference: perf ${q.scores.performance}→${s.performance} (ref runs ${q.spread.performance.join(",")}) · ${dl("TBT", "ms")} · ${dl("LCP", "ms")} · ${dl("CLS")}`);
  }
}
if (target.local && !asBot) notes.push("localhost: LCP/FCP/SI here are not the site's — judge the change by TBT and CLS, confirm load on the real host (a deploy URL)");
if (asBot) notes.push(`robot form (${o.bot}): what crawlers and PageSpeed (its UA says Lighthouse) are served. People's numbers are the run without --as-bot — never mix the two records`);
for (const n of notes) console.log(`  · ${n}`);

finish({
  outDir, rel, pass,
  result: { tool: "lighthouse", url: o.url, reference: o.ab || null, asBot, bot: asBot ? o.bot : null, at: new Date().toISOString(), runs, devices, load: load0.load, thresholds: { minPerf, minOther }, results, referenceResults: o.ab ? reference : undefined, notes },
  summary: pass ? `every profile meets perf ≥ ${minPerf} and A11y/BP/SEO ≥ ${minOther} (medians of ${runs})` : `a profile is below perf ${minPerf} or A11y/BP/SEO ${minOther} — see the failing audits above`,
});
