#!/usr/bin/env node
// Scene fps probe: how many frames the WebGL scene ACTUALLY draws, against how
// many frames the page gets. Lighthouse and the scroll test count the page's
// frames; a scene throttled to "30 fps on phones" passes both while a person
// sees ~20 fps. Measured on production sites: a `t - last <= 1000/30` budget
// throttle on a 60 Hz loop draws every 3rd frame (20 fps), on 120 Hz every 5th
// (26 fps); lifting it gave 120 fps at rest with the phone scroll test the same
// or better (5 sites). Rule: no fixed phone frame cap — pay for smoothness with
// a cheaper frame (DPR, samples, particles); if a cap is truly needed, skip
// alternate frames (frame % 2), never a time budget.
//
//   node tools/qa/fps-probe.mjs --url http://localhost:4500/
//   node tools/qa/fps-probe.mjs --url … --device desktop
//   node tools/qa/fps-probe.mjs --url … --scroll-start 2400     # a scene further down the page
//   node tools/qa/fps-probe.mjs --url … --min-ratio 0.9 --cpu 4 --wait 9000
//
// Headed Chrome (real GPU, a window opens), phone viewport, 4× CPU, people UA.
// 5 s at rest, then 5 s scrolling (touch flings on phone, wheel on PC). A
// "scene frame" is a rAF frame in which any WebGL draw call happened; only
// frames with a scene canvas on screen count (pausing off screen is right).
// Verdict: scene frames / rAF frames ≥ --min-ratio (0.8) in both windows. A
// ratio near 1/2, 1/3, 1/5 is a cap. A scene that draws nothing at rest (on
// demand) passes at rest. An OffscreenCanvas (worker) scene can't be counted
// on the page's thread — the probe says so instead of guessing.
import { cli, checkTarget, finish, sleep, warnIfBusy } from "./lib/run.mjs";
import { launch, DEVICES } from "./lib/chrome.mjs";
import { CANVAS_PROBE } from "./lib/canvas-probe.mjs";
import { installScroller, scrollToY, scrollState } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/fps-probe.mjs --url <url> [--device mobile|desktop] [--wait 9000] [--cpu 4] [--scroll-start px] [--min-ratio 0.8]`;
const { o, outDir, rel } = cli("fps-probe", USAGE, {
  device: { type: "string", default: "mobile" }, wait: { type: "string", default: "9000" }, cpu: { type: "string" },
  "scroll-start": { type: "string", default: "0" }, "min-ratio": { type: "string", default: "0.8" }, "allow-dev": { type: "boolean" },
});
const dev = DEVICES[o.device] || DEVICES.mobile;
const desktop = o.device === "desktop";
const cpu = Number(o.cpu ?? dev.cpu);
const minRatio = Number(o["min-ratio"]);
await checkTarget(o.url);
warnIfBusy();

// Draw calls are counted per canvas (lib/canvas-probe.mjs) — wrapping the
// WebGL prototypes missed a production three.js scene entirely, and one global
// counter lets a cheap canvas drawing every frame hide a capped scene beside
// it. Per canvas, a "scene frame" is a rAF frame in which its draw counter
// moved; only frames with that canvas on screen count (pausing off screen is right).
const INIT = () => {
  const s = (window.__fps = { on: false, per: {}, offscreen: 0 });
  const tick = (now) => {
    const all = [...document.querySelectorAll("canvas")];
    s.offscreen = all.filter((c) => c.__qaOffscreen).length;
    for (const c of all) {
      if (!c.__qaDraws || !c.dataset.qaId) continue;
      const e = (s.per[c.dataset.qaId] ??= { seen: c.__qaDraws, raf: 0, draws: 0, last: 0, gaps: [], off: 0 });
      const drew = c.__qaDraws !== e.seen;
      e.seen = c.__qaDraws;
      if (!s.on) continue;
      const r = c.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < innerHeight && r.width > 0)) { e.off++; e.last = 0; continue; }
      e.raf++;
      e.box = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (drew) { e.draws++; if (e.last) e.gaps.push(now - e.last); e.last = now; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(b.length * p))].toFixed(1) : null; };

const browser = await launch({ headless: false, window: { w: dev.viewport.width + 40, h: dev.viewport.height + 140 } });
const windows = {};
let offscreen = 0, scrollError = null;
try {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport(dev.viewport);
  await page.setUserAgent(dev.ua);
  const cdp = await page.createCDPSession();
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.evaluateOnNewDocument(CANVAS_PROBE, { preserve: false });
  await page.evaluateOnNewDocument(INIT);
  await installScroller(page);
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await sleep(Number(o.wait));
  if (Number(o["scroll-start"])) {
    const sc = await scrollToY(page, Number(o["scroll-start"]), { settle: 1500 });
    if (sc.error) scrollError = `--scroll-start: ${sc.error}`;
  }
  const measure = async (label, during) => {
    await page.evaluate(() => { const s = window.__fps; s.on = true; for (const e of Object.values(s.per)) Object.assign(e, { raf: 0, draws: 0, last: 0, gaps: [], off: 0 }); });
    const t0 = Date.now();
    if (during) await during();
    const left = 5000 - (Date.now() - t0); if (left > 0) await sleep(left);
    const s = await page.evaluate(() => { const s = window.__fps; s.on = false; return { per: s.per, offscreen: s.offscreen }; });
    const secs = (Date.now() - t0) / 1000;
    offscreen = s.offscreen;
    const canvases = Object.entries(s.per).filter(([, e]) => e.raf + e.off > 0).map(([id, e]) => {
      const onSecs = Math.max(0.001, secs * (e.raf / Math.max(1, e.raf + e.off)));
      return { id, box: e.box || "-", onScreenSeconds: +onSecs.toFixed(1), pagePerS: +(e.raf / onSecs).toFixed(1), scenePerS: +(e.draws / onSecs).toFixed(1), ratio: e.raf ? +(e.draws / e.raf).toFixed(2) : null, gap: { p50: pct(e.gaps, 0.5), p95: pct(e.gaps, 0.95), max: pct(e.gaps, 1) } };
    });
    windows[label] = canvases;
    if (!canvases.length) console.log(`  ${label.padEnd(10)} no canvas drew on the page's thread`);
    for (const c of canvases) console.log(`  ${label.padEnd(10)} canvas #${c.id} ${c.box}: ${c.ratio == null ? "off screen the whole window" : `scene ${c.scenePerS} fps of the page's ${c.pagePerS} (ratio ${c.ratio}) · scene gap p50 ${c.gap.p50} / p95 ${c.gap.p95} ms · on screen ${c.onScreenSeconds}s`}`);
  };
  console.log(`▸ ${o.device} · ${cpu}× CPU · headed Chrome`);
  await measure("rest");
  const s0 = await scrollState(page);
  let lo = s0.y, hi = s0.y;
  await measure("scrolling", async () => {
    const end = Date.now() + 4800;
    let dir = 1;
    const { width: vw, height: vh } = dev.viewport;
    while (Date.now() < end) {
      if (desktop) { await page.mouse.move(vw / 2, vh / 2); for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: 120 * dir }); await sleep(40); } }
      else await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(vw / 2), y: Math.round(vh * 0.7), yDistance: -Math.round(vh * 0.6) * dir, speed: 1200, gestureSourceType: "touch" });
      const [py, max] = await page.evaluate(() => [window.__sy(), window.__max()]);
      lo = Math.min(lo, py); hi = Math.max(hi, py);
      const y = py / Math.max(1, max);
      if (y > 0.9) dir = -1; else if (y < 0.05) dir = 1;
    }
  });
  // A long page that the scrolling window never moved measured the rest window twice.
  if (!scrollError && s0.unclaimed) scrollError = `the page reads as one screen, but ${s0.unclaimed} scrolls — the probe cannot follow its position, so the scrolling window is unverified`;
  if (!scrollError && s0.max > 16 && hi - lo <= 2) scrollError = `the page is ${s0.max} px longer than its screen but the scrolling window moved it 0 px (scroller: ${s0.scroller})`;
} finally { await browser.close(); }

const verdicts = [];
let pass = true;
for (const [label, list] of Object.entries(windows)) {
  const counted = list.filter((c) => c.ratio != null && c.onScreenSeconds >= 1);
  if (!counted.length) { verdicts.push(`${label}: no main-thread WebGL drawing on screen${offscreen ? " (an OffscreenCanvas worker scene — not countable here; judge it on a device)" : label === "rest" ? " (an on-demand scene, or none)" : ""}`); continue; }
  for (const c of counted) {
    if (c.ratio === 0 && label === "rest") { verdicts.push(`${label}: canvas #${c.id} idle at rest (on demand)`); continue; }
    if (c.ratio < minRatio) {
      pass = false;
      const k = Math.round(1 / Math.max(c.ratio, 0.01));
      verdicts.push(`${label}: canvas #${c.id} draws ${c.scenePerS} of the page's ${c.pagePerS} fps${k >= 2 && Math.abs(c.ratio * k - 1) < 0.15 ? ` — every ${k}${k === 2 ? "nd" : k === 3 ? "rd" : "th"} frame: a frame cap` : ""}`);
    } else verdicts.push(`${label}: canvas #${c.id} keeps up (${c.scenePerS} of ${c.pagePerS} fps)`);
  }
}
if (scrollError) { pass = false; verdicts.unshift(`ERROR: ${scrollError}`); }
for (const v of verdicts) console.log(`  · ${v}`);
console.log("  · 120 Hz screens: per-frame easings and speeds must scale by dt, or motion runs 2× fast there — this probe counts frames, not speed");
finish({ outDir, rel, pass, result: { tool: "fps-probe", url: o.url, device: o.device, cpu, minRatio, offscreenScenes: offscreen, windows, verdicts }, summary: verdicts.join(" · ") });
