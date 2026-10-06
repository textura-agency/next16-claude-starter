#!/usr/bin/env node
// Live-resize check: does a page that is RESIZED land where a FRESH load at
// the same size does? Fresh loads can be perfect while a resize leaves stale
// state behind — sizes measured on mount, a one-screen layout's scroll lock, a
// DPR read once, a camera framed for desktop (a 3D product kept its desktop
// size after a window resize while every box matched — only the pixels showed it).
//
//   node tools/qa/resize-check.mjs --url http://localhost:4500/
//   node tools/qa/resize-check.mjs --url … --sel "canvas,main,h1,header,footer" --tol 4 --settle 1500,4000
//   node tools/qa/resize-check.mjs --url … --only window-down,device-preset
//
// Scenarios — each ends at a size and is compared with a fresh load there:
//   window-down    a real window 1440×900 → 500×844 in one jump   (CDP Browser.setWindowBounds)
//   window-drag    the same as a slow drag, 20 px steps
//   window-up      500×844 scrolled to the bottom → 1440×900, then back to the top
//   device-preset  desktop → DevTools phone preset: 390×844, DPR 3, mobile, touch
//   device-back    that preset → no override
//   responsive     DevTools Responsive mode: width 1440 → 390 by drag, DPR 1
//   rotate         tablet 768×1024 → 1024×768, emulated
// `page.setViewport` is NOT a window resize — a viewport change passed while a
// real window resize broke the page; the window-* scenarios resize the window.
// Chrome won't size a window below 500 px wide, so device mode covers phones.
//
// Per scenario and settle moment: every --sel box (first match) whose size or
// position differs from the fresh load by > --tol px, plus scrollY, document
// height and horizontal overflow; then PSNR of the resized vs fresh pixels and
// a strip `<scenario>.png`: resized at each settle moment | fresh (right).
// LOOK at every strip — the numbers flag, the eye decides. PSNR is modest on
// anything that moves; compare scenarios, a low one is where to look.
// Exit 1 when any scenario's boxes differ. Also run it on `next dev` if you
// review there (StrictMode double-mounts, HMR) — with --allow-dev.
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cli, checkTarget, finish, sleep } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { psnr, strip } from "./lib/image.mjs";

const USAGE = `usage: node tools/qa/resize-check.mjs --url <url> [--sel "canvas,main,h1,header,footer"] [--tol 2] [--settle 1500,4000] [--only a,b] [--hide <selector>]`;
const { o, outDir, rel } = cli("resize-check", USAGE, {
  sel: { type: "string", default: "canvas,model-viewer,main,h1,header,footer" }, settle: { type: "string", default: "1500,4000" },
  tol: { type: "string", default: "2" }, only: { type: "string" }, hide: { type: "string", default: "[aria-label='Cookie consent'],[data-cookie-banner]" },
  "allow-dev": { type: "boolean" },
});
await checkTarget(o.url);
const SELS = o.sel.split(",").map((s) => s.trim()).filter(Boolean);
const SETTLE = o.settle.split(",").map(Number);
const TOL = Number(o.tol);
const tmp = join(outDir, ".shots");
mkdirSync(tmp, { recursive: true });

const browser = await launch({ headless: true, window: { w: 1440, h: 900 } });
const open = async () => {
  const page = await browser.newPage();
  await page.setUserAgent(UA.desktop);
  const cdp = await page.createCDPSession();
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  const win = (w, h) => cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: w, height: h, windowState: "normal" } });
  const emulate = async (m) => {
    if (!m) { await cdp.send("Emulation.clearDeviceMetricsOverride"); await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false }); await page.setUserAgent(UA.desktop); return; }
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: m.w, height: m.h, deviceScaleFactor: m.dpr, mobile: !!m.mobile });
    await cdp.send("Emulation.setTouchEmulationEnabled", m.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await cdp.send("Emulation.setEmitTouchEventsForMouse", { enabled: !!m.touch, configuration: m.mobile ? "mobile" : "desktop" });
    if (m.mobile) await page.setUserAgent(UA.iphone);
  };
  return { page, win, emulate };
};
const state = (page) => page.evaluate((sels) => {
  const out = { scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth - innerWidth, vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, boxes: {} };
  for (const s of sels) { const el = document.querySelector(s); if (!el) continue; const r = el.getBoundingClientRect(); out.boxes[s] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }
  return out;
}, SELS);
const diff = (a, b) => {
  const d = [];
  if (Math.abs(a.scrollY - b.scrollY) > TOL) d.push(`scrollY ${a.scrollY} vs ${b.scrollY}`);
  if (Math.abs(a.docH - b.docH) > TOL) d.push(`document height ${a.docH} vs ${b.docH}`);
  if (a.overflowX > 0) d.push(`horizontal overflow ${a.overflowX}px (zooms a phone page out)`);
  for (const k of new Set([...Object.keys(a.boxes), ...Object.keys(b.boxes)])) {
    const [x, y] = [a.boxes[k], b.boxes[k]];
    if (!x || !y) { d.push(`${k} ${x ? "only after resize" : "only on fresh load"}`); continue; }
    if (x.some((v, i) => Math.abs(v - y[i]) > TOL)) d.push(`${k} [${x}] vs fresh [${y}]`);
  }
  return d;
};
const hide = (page) => page.evaluate((sel) => { for (const el of document.querySelectorAll(sel)) el.style.setProperty("visibility", "hidden", "important"); }, o.hide).catch(() => {});

const PHONE = { w: 390, h: 844, dpr: 3, mobile: true, touch: true };
const SCENARIOS = [
  { name: "window-down", setup: (t) => t.win(1440, 900), act: (t) => t.win(500, 844), end: { kind: "window", w: 500, h: 844 } },
  { name: "window-drag", setup: (t) => t.win(1440, 900), act: async (t) => { for (let w = 1440; w >= 500; w -= 20) { await t.win(w, 900 - Math.round((1440 - w) * 0.06)); await sleep(30); } await t.win(500, 844); }, end: { kind: "window", w: 500, h: 844 } },
  { name: "window-up", setup: async (t) => { await t.win(500, 844); }, afterLoad: (t) => t.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)), act: (t) => t.win(1440, 900), end: { kind: "window", w: 1440, h: 900 }, backToTop: true },
  { name: "device-preset", setup: (t) => t.win(1440, 900), act: (t) => t.emulate(PHONE), end: { kind: "emulate", m: PHONE } },
  { name: "device-back", setup: async (t) => { await t.win(1440, 900); await t.emulate(PHONE); }, act: (t) => t.emulate(null), end: { kind: "window", w: 1440, h: 900 } },
  { name: "responsive", setup: (t) => t.win(1440, 900), act: async (t) => { for (let w = 1440; w >= 390; w -= 30) { await t.emulate({ w, h: 900, dpr: 1, mobile: false }); await sleep(30); } await t.emulate({ w: 390, h: 900, dpr: 1, mobile: false }); }, end: { kind: "emulate", m: { w: 390, h: 900, dpr: 1, mobile: false } } },
  { name: "rotate", setup: async (t) => { await t.win(1440, 900); await t.emulate({ w: 768, h: 1024, dpr: 2, mobile: true, touch: true }); }, act: (t) => t.emulate({ w: 1024, h: 768, dpr: 2, mobile: true, touch: true }), end: { kind: "emulate", m: { w: 1024, h: 768, dpr: 2, mobile: true, touch: true } } },
].filter((s) => !o.only || o.only.split(",").includes(s.name));

let failed = 0;
const scenarios = [];
try {
  for (const sc of SCENARIOS) {
    const r = await open();
    await sc.setup(r);
    await r.page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
    await sleep(4000);
    if (sc.afterLoad) { await sc.afterLoad(r); await sleep(800); }
    await sc.act(r);
    const shots = [], lines = [];
    let waited = 0;
    for (const ms of SETTLE) {
      await sleep(ms - waited); waited = ms;
      // window-up: the browser keeps the old offset (fine) — bring the reader back to the top and compare layouts there.
      if (sc.backToTop) { await r.page.evaluate(() => (window.lenis ? window.lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0))); await sleep(500); waited += 500; }
      await hide(r.page);
      const a = await state(r.page);
      const f = join(tmp, `${sc.name}-${ms}-resized.png`);
      await r.page.screenshot({ path: f });
      shots.push(f); lines.push({ ms, a });
    }
    await r.page.close();
    const f = await open();
    if (sc.end.kind === "window") await f.win(sc.end.w, sc.end.h); else { await f.win(1440, 900); await f.emulate(sc.end.m); }
    await f.page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
    await sleep(SETTLE.at(-1));
    await hide(f.page);
    const b = await state(f.page);
    const fresh = join(tmp, `${sc.name}-fresh.png`);
    await f.page.screenshot({ path: fresh });
    await f.page.close();
    // Boxes can match while what an element DRAWS is stale — compare pixels too.
    const p = psnr(shots.at(-1), fresh);
    let bad = false;
    const rows = [];
    for (const { ms, a } of lines) {
      const d = diff(a, b);
      if (d.length) bad = true;
      rows.push({ ms, differences: d });
      console.log(`  ${d.length ? "≠" : "="} ${sc.name.padEnd(14)} +${ms}ms  ${a.vw}x${a.vh} (fresh ${b.vw}x${b.vh}) dpr ${a.dpr}${d.length ? "  —  " + d.join(" · ") : ""}`);
    }
    console.log(`    ${sc.name.padEnd(14)} pixels vs fresh: PSNR ${p === Infinity ? "∞" : p ?? "n/a (sizes differ)"} dB`);
    if (bad) failed++;
    strip([...shots, fresh], join(outDir, `${sc.name}.png`), 600);
    scenarios.push({ name: sc.name, rows, psnr: p === Infinity ? "inf" : p, strip: `${sc.name}.png` });
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`  strips → ${rel(outDir)}  (resized at each settle moment … | fresh load, right) — look at every one`);
finish({ outDir, rel, pass: failed === 0, result: { tool: "resize-check", url: o.url, sels: SELS, tol: TOL, scenarios }, summary: failed ? `${failed} of ${scenarios.length} resize paths land somewhere a fresh load doesn't` : `all ${scenarios.length} resize paths match a fresh load` });
