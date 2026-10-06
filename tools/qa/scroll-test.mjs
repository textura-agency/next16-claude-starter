#!/usr/bin/env node
// The scroll test — the bar Lighthouse can't see. A visible real Chrome
// scrolls the whole page like a person (PC: wheel bursts; phone: touch flings
// at 4× CPU on 4G), cold (fresh profile) then warm (second visit), ≥ 3 runs per
// device, and judges every frame.
//
//   node tools/qa/scroll-test.mjs --url http://localhost:4500/
//   node tools/qa/scroll-test.mjs --url … --devices mobile --runs 1     # chase one freeze
//   node tools/qa/scroll-test.mjs --url … --first-scroll                # + scroll from the unlock frame
//   node tools/qa/scroll-test.mjs --url … --video                       # + one unmeasured recording per device (needs ffmpeg)
//   node tools/qa/scroll-test.mjs --url … --headless                    # no window — less faithful GPU behaviour
//
// Verdict per device (the worse of cold and warm, medians across runs):
//   ideal   no frame > 50 ms · ≤ 1 % dropped · p99 ≤ 33 ms     ← the bar
//   smooth  no frame > 100 ms · ≤ 3 % dropped
//   janky   anything else
//   incomplete  the pass did not reach the bottom (pinned / locked / not ready) — not a result
// Exit 0 only when every device is ideal (--accept smooth to relax).
//
// Each freeze is printed with how many runs reproduced it (3/3 = a bug, 1/3 =
// re-run first), the section under the viewport's centre, and its cause:
// script / React render / React mounting a lazy chunk / render (style+layout)
// / decode (media fetched just before) / gpu-raster (main thread idle).
// Budgets are 60 Hz even on a 120 Hz screen.
import { execFileSync } from "node:child_process";
import { cli, checkTarget, headersFrom, finish, warnIfBusy } from "./lib/run.mjs";
import { scrollTest, DEVICES } from "./lib/scroll.mjs";

const USAGE = `usage: node tools/qa/scroll-test.mjs --url <url> [--devices desktop,mobile] [--runs 3] [--first-scroll] [--video] [--headless] [--accept ideal|smooth] [--header "k: v"]`;
const { o, outDir, rel } = cli("scroll-test", USAGE, {
  devices: { type: "string", default: "desktop,mobile" }, runs: { type: "string", default: "3" },
  "first-scroll": { type: "boolean" }, video: { type: "boolean" }, headless: { type: "boolean" },
  accept: { type: "string", default: "ideal" }, header: { type: "string", multiple: true },
  "ready-timeout": { type: "string", default: "30" }, "allow-dev": { type: "boolean" },
});
const devices = o.devices.split(",").map((s) => s.trim()).filter(Boolean);
for (const d of devices) if (!DEVICES[d]) { console.error(`✖ unknown device "${d}" — one of ${Object.keys(DEVICES).join(", ")}`); process.exit(2); }
const runs = Number(o.runs);
const headers = headersFrom(o.header);
if (o.video) { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { console.error("✖ --video needs ffmpeg on PATH (puppeteer's screencast encodes with it)"); process.exit(2); } }

console.log(`▸ scroll test · ${devices.join(" + ")} × ${runs}${o.headless ? " · headless" : " · a Chrome window opens — leave it visible"}`);
if (runs < 3) console.log(`  ! --runs ${runs}: for iterating; a verdict is the median of ≥ 3`);
const target = await checkTarget(o.url, { headers });
const load = warnIfBusy();

const { result, config } = await scrollTest({ url: o.url, devices, runs, outDir, headless: o.headless, video: o.video, firstScroll: o["first-scroll"], headers, readyTimeout: Number(o["ready-timeout"]) * 1000 });

const RANK = { ideal: 0, smooth: 1, janky: 2, incomplete: 3, error: 4 };
const okRank = RANK[o.accept] ?? 0;
let pass = true;
console.log("");
for (const [d, r] of Object.entries(result)) {
  if (r.error) { pass = false; console.log(`  ✖ ${d.padEnd(8)} ERROR — ${r.error}`); continue; }
  if (RANK[r.verdict] > okRank) pass = false;
  const p = (k) => `${k} ${r[k].verdict} (max ${r[k].max}ms, p99 ${r[k].p99}, >50ms ${r[k].over50}, dropped ${r[k].droppedPct}%, fetched ${r[k].fetchedCount})`;
  console.log(`  ${RANK[r.verdict] > okRank ? "✖" : "✔"} ${d.padEnd(8)} ${r.verdict.toUpperCase()}${r.static ? " (one-screen page: pointer sweeps, not scrolling)" : ""}  │ ${p("cold")}  │ ${p("warm")}`);
  if (r.readyMs > 3000) console.log(`      scroll was locked ${Math.round(r.readyMs / 100) / 10}s after load (loader / intro lock)`);
  for (const f of [...r.cold.freezeSections.map((x) => ({ ...x, pass: "cold" })), ...r.warm.freezeSections.map((x) => ({ ...x, pass: "warm" }))].sort((a, b) => b.worstMs - a.worstMs).slice(0, 6))
    console.log(`      ${String(f.worstMs).padStart(4)}ms  ${f.reproduced}  ${f.pass}  ${f.cause.padEnd(34)} ${f.section}`);
  if (r.cold.droppedPct > 1) for (const g of (r.cold.dropsBySection || []).slice(0, 3))
    console.log(`      drops ${String(g.droppedPct).padStart(5)}%  (${g.dropped} frames over ${g.seconds}s, cold)  ${g.section}`);
  if (r.cold.fetched?.length) console.log(`      fetched during the cold pass: ${r.cold.fetched.length} (each one is a freeze waiting for a slower link)`);
  if (r.firstScroll) {
    const fs = r.firstScroll;
    console.log(`      first scroll (from the unlock frame): max ${fs.max}ms, >50ms ${fs.over50}${fs.over50 ? "  ← what a person feels the instant the loader lets go" : ""}`);
    for (const f of fs.freezes.slice(0, 3)) console.log(`        ${String(f.ms).padStart(4)}ms  ${f.cause.padEnd(34)} ${f.section}`);
  }
}
if (target.local) console.log("  · localhost serves instantly: network emulation is on, but treat any mid-scroll fetch as a freeze a real 4G phone will feel");
console.log("  · not covered here: a phone's GPU (fill rate), iOS Safari (→ webkit-probe, ios-toolbar-probe), how fast a scene animates (→ fps-probe)");

const verdicts = Object.entries(result).map(([d, r]) => `${d} ${r.verdict}`).join(", ");
finish({ outDir, rel, pass, result: { tool: "scroll-test", url: o.url, at: new Date().toISOString(), runs, load: load.load, accept: o.accept, result, config }, summary: `${verdicts}${pass ? "" : ` — the bar is ${o.accept} on every device`}` });
