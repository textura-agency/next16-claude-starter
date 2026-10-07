#!/usr/bin/env node
// Which code is in the long task? CPU-profiles a cold load of a running
// production build under the device's CPU throttle and names the busiest runs
// of main-thread work by ORIGINAL file and function. Lighthouse names a chunk
// and a simulated time; this names the component. A diagnostic — no verdict
// beyond "the busiest run is under --budget ms".
//
//   node tools/qa/profile.mjs --url http://localhost:4500/                 # mobile, 4× CPU, top 3 busy runs
//   node tools/qa/profile.mjs --url … --device desktop                     # 1× CPU
//   node tools/qa/profile.mjs --url … --scroll-to "#pricing"               # then scroll there slowly (work that starts mid-scroll)
//   node tools/qa/profile.mjs --url … --scroll-to 4000                     # …or to a px offset
//   node tools/qa/profile.mjs --url … --as-bot                             # profile the robot form
//   node tools/qa/profile.mjs --url … --wait 12000 --top 5 --budget 200
//
// Source maps: names are only original when the build ships browser source
// maps. next.config.ts enables them only for a profiling build — never deploy it:
//   QA_SOURCEMAPS=1 yarn build && yarn start
// Without maps the tool still runs and attributes time to chunk files.
//
// Pitfalls: GPU on (without it a WebGL scene never builds under the profiler —
// one profile was 11.8 s idle of 12); a people UA (HeadlessChrome is a bot);
// one unprofiled load first (next/image encodes each size on first request);
// Lighthouse's task times are SIMULATED — map a task to code by this observed
// profile, never by lining Lighthouse's "at 3.4 s" up with the page's timeline.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SourceMap } from "node:module";
import { cli, checkTarget, finish, sleep, warnIfBusy } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { installScroller, scrollToSelector, scrollToY } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/profile.mjs --url <url> [--device mobile|desktop] [--wait 8000] [--scroll-to <selector|px>] [--as-bot] [--top 3] [--budget 0]`;
const { o, outDir, rel } = cli("profile", USAGE, {
  device: { type: "string", default: "mobile" }, wait: { type: "string", default: "8000" },
  "scroll-to": { type: "string" }, "as-bot": { type: "boolean" }, top: { type: "string", default: "3" },
  budget: { type: "string", default: "0" }, "allow-dev": { type: "boolean" },
});
const mobile = o.device !== "desktop";
await checkTarget(o.url);
warnIfBusy();

const browser = await launch({ headless: true, args: ["--no-sandbox"] });
let top = [], hasMaps = false, profilePath, scrollError = null;
try {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 });
  const people = mobile ? UA.android : UA.desktop;
  await page.setUserAgent(o["as-bot"] ? UA.googlebot : people);
  const cdp = await page.createCDPSession();
  await installScroller(page);
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await sleep(3000);
  await page.goto("about:blank");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: mobile ? 4 : 1 });
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await sleep(Number(o.wait));
  if (o["scroll-to"]) {
    // 40 px a frame: the page's own scroll handlers and proximity gates fire
    // as they would for a visitor (Lenis, if present, follows native scroll).
    // Through the page's scroller — an inner full-screen div when <html>/<body>
    // are locked; a long page that does not move is an error, not a profile.
    const sel = o["scroll-to"], step = { stepPx: 40, stepMs: 0 };
    const sc = /^\d+$/.test(sel) ? await scrollToY(page, Number(sel), step) : await scrollToSelector(page, sel, step);
    if (!sc) scrollError = `no element matches ${sel}`;
    else if (sc.error) scrollError = `--scroll-to ${sel}: ${sc.error}`;
    else console.log(`  scrolled ${sc.scroller} to y=${sc.y} of ${sc.max}`);
    if (scrollError) console.log(`  ✖ ${scrollError}`);
    await sleep(3000);
  }
  const { profile } = await cdp.send("Profiler.stop");
  profilePath = join(outDir, "load.cpuprofile");
  writeFileSync(profilePath, JSON.stringify(profile));

  // Turbopack names a chunk's map differently from the chunk: follow sourceMappingURL.
  const maps = new Map();
  const mapFor = async (url) => {
    if (maps.has(url)) return maps.get(url);
    let m = null;
    try {
      const ref = (await (await fetch(url)).text()).match(/sourceMappingURL=(\S+)\s*$/)?.[1];
      if (ref) { const r = await fetch(new URL(ref, url)); if (r.ok) { m = new SourceMap(await r.json()); hasMaps = true; } }
    } catch { /* unmapped */ }
    maps.set(url, m);
    return m;
  };
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const names = new Map();
  for (const n of profile.nodes) {
    const cf = n.callFrame;
    let label = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop() || cf.functionName}`;
    if (cf.url.startsWith("http")) {
      const e = (await mapFor(cf.url))?.findEntry(cf.lineNumber, cf.columnNumber);
      if (e?.originalSource) label = `${e.name || cf.functionName || "(anon)"} ${e.originalSource.replace(/^.*?(node_modules|src)\//, "$1/")}:${e.originalLine + 1}`;
    }
    names.set(n.id, label);
  }

  // Busy runs: contiguous non-idle samples — what a long task looks like from the profiler.
  let t = profile.startTime;
  const times = profile.samples.map((_, i) => (t += profile.timeDeltas[i]));
  const runs = [];
  let cur = null;
  profile.samples.forEach((id, i) => {
    if (byId.get(id).callFrame.functionName !== "(idle)") { cur ??= { s: times[i], idx: [] }; cur.e = times[i]; cur.idx.push(i); }
    else if (cur) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);

  const pkg = (label) => {
    const f = label.split(" ")[1]?.split(":")[0] || "";
    const m = f.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    return m ? m[1] : f.startsWith("src/") ? f : f.endsWith(".js") ? `chunk ${f}` : "(native / unmapped)";
  };
  console.log(`▸ ${o.device} (${mobile ? 4 : 1}× CPU)${o["as-bot"] ? " · robot form" : ""} · busiest runs of main-thread work after navigation`);
  top = runs.map((r) => ({ ...r, d: (r.e - r.s) / 1000 })).sort((a, b) => b.d - a.d).slice(0, Number(o.top));
  for (const r of top) {
    const self = new Map(), incl = new Map();
    for (const i of r.idx) {
      const d = (profile.timeDeltas[i + 1] || 100) / 1000;
      let id = profile.samples[i];
      const k = pkg(names.get(id));
      self.set(k, (self.get(k) || 0) + d);
      const seen = new Set();
      while (id) { const L = names.get(id); if (!seen.has(L)) { incl.set(L, (incl.get(L) || 0) + d); seen.add(L); } id = parent.get(id); }
    }
    r.self = [...self].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, +v.toFixed(1)]);
    r.libs = [...incl].filter(([k]) => k.includes(" node_modules/") && !/react-dom|scheduler/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k.replace(/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?/, ""), +v.toFixed(1)]);
    r.own = [...incl].filter(([k]) => k.includes(" src/")).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, +v.toFixed(1)]);
    console.log(`\n  ${r.d.toFixed(0)} ms at +${((r.s - profile.startTime) / 1000).toFixed(0)} ms`);
    console.log("   self time by package / file:");
    for (const [k, v] of r.self) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`);
    if (r.libs.length) { console.log("   library code, inclusive:"); for (const [k, v] of r.libs) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`); }
    if (r.own.length) { console.log("   project code, inclusive:"); for (const [k, v] of r.own) console.log(`     ${v.toFixed(1).padStart(6)}  ${k}`); }
  }
  if (!hasMaps) console.log("\n  ! no browser source maps found — times are per chunk, not per component. Profile a build made with QA_SOURCEMAPS=1 yarn build (see the header).");
  console.log(`\n  profile → ${rel(profilePath)} (open in Chrome DevTools → Performance)`);
} finally {
  await browser.close();
}

const budget = Number(o.budget);
const worst = top[0]?.d ?? 0;
const pass = !scrollError && (!budget || worst <= budget);
finish({
  outDir, rel, pass,
  result: { tool: "profile", url: o.url, device: o.device, asBot: !!o["as-bot"], sourceMaps: hasMaps, busiest: top.map((r) => ({ ms: Math.round(r.d), self: r.self, libs: r.libs, own: r.own })) },
  summary: scrollError ? `ERROR: ${scrollError}` : budget ? `busiest main-thread run ${Math.round(worst)} ms (budget ${budget} ms)` : `busiest main-thread run ${Math.round(worst)} ms — a diagnostic; pass --budget <ms> to make it a gate`,
});
