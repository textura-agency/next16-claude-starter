#!/usr/bin/env node
// WebKit probe: the iOS-only bugs. Playwright's WebKit (the engine inside
// every iOS browser) with an iPhone device profile, scrolled the way a thumb
// does — momentum flicks, partial scrolls, past-and-back, to the bottom and
// back, quick reversals, a URL-bar height change mid-fling, a status-bar tap
// to the top. At every stop it records, for EVERY canvas on the page, whether
// it is on screen, shown (opacity / visibility / display of it and every
// ancestor), its WebGL context state, whether it is still DRAWING, and how its
// region looks in a real screenshot compared with its first good frame.
//
// Why it exists: headless Chrome missed an iOS-only "the hero disappears after
// scrolling" bug twice. iOS drops a canvas's last frame after a toolbar resize
// and drops WebGL contexts under memory pressure — a scene that stops drawing
// while visible, or never rebuilds a lost context, is blank on an iPhone and
// fine everywhere else. Rule from production sites: never stop drawing a
// visible WebGL canvas on iOS; pause only when it is off screen.
//
//   node tools/qa/webkit-probe.mjs --url http://localhost:4500/
//   node tools/qa/webkit-probe.mjs --url … --iterations 4 --shots          # a shot at every step
//   node tools/qa/webkit-probe.mjs --url … --faults                        # + WebGL context losses at the worst moments
//   node tools/qa/webkit-probe.mjs --url … --gpu-kill                      # + kill WebKit's GPU process (macOS; iOS jetsam)
//   node tools/qa/webkit-probe.mjs --url … --device "iPhone 15 Pro Max" --headed
//
// The flicks are driven per frame in the page (an initial velocity decaying
// like UIScrollView's 0.998/ms) — Playwright cannot synthesise native touch
// scrolling in WebKit — so the engine itself fires the scroll events, as the
// compositor does on a phone. The probe forces preserveDrawingBuffer so the
// canvas can be read back.
// A step FAILS when a canvas on screen is: context-lost, hidden by CSS,
// drawing nothing while it drew at its first look, or blank in the screenshot
// (luminance stddev < 30 % of its first good frame, with ≥ 60 % of it on
// screen). Exit 1 on any failing step. fail-*.png in the report dir — look.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { cli, checkTarget, finish } from "./lib/run.mjs";
import { playwright } from "./lib/deps.mjs";
import { CANVAS_PROBE, ISOLATE_CSS } from "./lib/canvas-probe.mjs";
import { regionStats } from "./lib/image.mjs";
import { installScroller, scrollState } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/webkit-probe.mjs --url <url> [--device "iPhone 13"] [--iterations 2] [--wait 9000] [--shots] [--faults] [--gpu-kill] [--headed] [--no-isolate]`;
const { o, outDir, rel } = cli("webkit-probe", USAGE, {
  device: { type: "string", default: "iPhone 13" }, iterations: { type: "string", default: "2" }, wait: { type: "string", default: "9000" },
  shots: { type: "boolean" }, faults: { type: "boolean" }, "gpu-kill": { type: "boolean" }, headed: { type: "boolean" },
  "no-isolate": { type: "boolean" }, "no-scroll": { type: "boolean" }, "allow-dev": { type: "boolean" },
});
await checkTarget(o.url);
const { webkit, devices } = await playwright();
const profile = devices[o.device];
if (!profile) { console.error(`✖ unknown device "${o.device}" — e.g. "iPhone 13", "iPhone 15 Pro Max" (Playwright's device list)`); process.exit(2); }
const vp = profile.viewport;

// WebKit's GPU process(es) belonging to THIS run (other runs may be live).
const gpuPids = () => { try { return new Set(execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).split("\n").filter((l) => /WebKit\.GPU|WebKitGPU|GPUProcess/.test(l)).map((l) => Number(l.trim().split(/\s+/)[0]))); } catch { return new Set(); } };
const gpuBefore = gpuPids();

const browser = await webkit.launch({ headless: !o.headed });
const context = await browser.newContext({ ...profile });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
const logs = [];
let crashed = false;
page.on("console", (m) => { if (/error|warn/.test(m.type())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 200)); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message.slice(0, 200)));
page.on("crash", () => { crashed = true; console.log("  ✖ PAGE CRASHED (WebContent process gone)"); });

await page.addInitScript(CANVAS_PROBE, { preserve: true });
// Every flick, jump and read goes through the page's scroller (lib/scroller.mjs):
// a page that locks <html>/<body> and scrolls a full-screen div never moves under window.scrollBy.
await installScroller(page);
await page.addInitScript(() => {
  // A thumb flick, per frame: velocity v0 (px/ms, + = down) decaying like UIScrollView.
  window.__fling = (v0, { decel = 0.998, reverseAfterMs = 0, v1 = 0 } = {}) => new Promise((resolve) => {
    let v = v0, last = performance.now(); const start = last; let reversed = false;
    const step = (now) => {
      const dt = Math.min(34, now - last); last = now;
      if (reverseAfterMs && !reversed && now - start > reverseAfterMs) { v = v1; reversed = true; }
      window.__by(v * dt);
      v *= Math.pow(decel, dt);
      if (Math.abs(v) > 0.02) requestAnimationFrame(step); else resolve(window.__sy());
    };
    requestAnimationFrame(step);
  });
});

// A crashed WebContent process leaves evaluate hanging: fail loudly instead.
const guard = (p, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out${crashed ? " (page crashed)" : ""}`)), 25_000))]);
const read = () => guard(page.evaluate(async () => {
  const list = __qa.all();
  const els = [...document.querySelectorAll("canvas")].filter((c) => c.dataset.qaId);
  const d0 = Object.fromEntries(els.map((c) => [c.dataset.qaId, c.__qaDraws || 0]));
  await new Promise((r) => setTimeout(r, 300));
  for (const c of list) {
    const el = els.find((e) => e.dataset.qaId === c.id);
    c.draws300 = el ? (el.__qaDraws || 0) - (d0[c.id] || 0) : 0;
    c.readback = el ? __qa.readback(el) : null;
  }
  return { y: Math.round(window.__sy()), vh: innerHeight, canvases: list };
}), "state read");

const shot = async () => {
  if (!o["no-isolate"]) await page.addStyleTag({ content: ISOLATE_CSS("canvas") }).then((h) => h.evaluate((el) => { el.id = "__qa-iso"; }));
  const buf = await page.screenshot({ scale: "css" });
  if (!o["no-isolate"]) await page.evaluate(() => document.getElementById("__qa-iso")?.remove());
  return buf;
};

const base = {}; // per canvas id: { draws300, std } from its first good look
const result = { url: o.url, device: o.device, steps: [], failures: [] };
let n = 0;
const check = async (label, { offOk = true } = {}) => {
  n++;
  const s = await read();
  const buf = await shot();
  const reasons = [];
  for (const c of s.canvases) {
    if (!c.onScreen || c.box.h < 40) continue;
    const rect = { x: Math.max(0, c.box.x), y: Math.max(0, c.box.y), w: Math.min(vp.width, c.box.x + c.box.w) - Math.max(0, c.box.x), h: Math.min(s.vh, c.box.y + c.box.h) - Math.max(0, c.box.y) };
    c.screen = rect.w > 4 && rect.h > 4 ? regionStats(buf, rect, 1) : null;
    const b = base[c.id];
    const why = [];
    if (c.lost) why.push("context lost");
    if (c.opacity < 0.05) why.push(`opacity ${c.opacity}`);
    if (c.flags.length) why.push(c.flags.join(", "));
    if (b && b.draws300 > 0 && c.draws300 === 0 && c.type !== "offscreen") why.push("stopped drawing while visible");
    if (b && c.screen && c.visibleFrac >= 0.6 && b.std > 3 && c.screen.std < b.std * 0.3) why.push(`blank on screen (stddev ${c.screen.std} vs ${b.std})`);
    if (why.length) reasons.push(`canvas #${c.id} ${c.box.w}x${c.box.h}@${c.box.y}: ${why.join("; ")}`);
    else if (!b && c.visibleFrac >= 0.6 && c.screen) base[c.id] = { draws300: c.draws300, std: c.screen.std };
  }
  if (!offOk && !s.canvases.length) reasons.push("no canvas on the page");
  const ok = reasons.length === 0;
  const step = { label, y: s.y, ok, reasons, canvases: s.canvases.map((c) => ({ id: c.id, onScreen: c.onScreen, visibleFrac: c.visibleFrac, box: c.box, type: c.type, lost: c.lost, opacity: c.opacity, draws300: c.draws300, std: c.screen?.std ?? null })) };
  result.steps.push(step);
  if (!ok) { result.failures.push(step); writeFileSync(join(outDir, `fail-${result.failures.length}-${label.replace(/[^\w-]+/g, "_")}.png`), buf); }
  else if (o.shots) writeFileSync(join(outDir, `${String(n).padStart(3, "0")}-${label.replace(/[^\w-]+/g, "_")}.png`), buf);
  const on = s.canvases.filter((c) => c.onScreen);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(30)} y=${String(s.y).padStart(5)} on screen: ${on.map((c) => `#${c.id} ${c.draws300}dr${c.screen ? " sd" + c.screen.std : ""}`).join(" ") || "—"}${reasons.length ? "  ← " + reasons.join(" | ") : ""}`);
  return step;
};

const fling = (v, extra) => guard(page.evaluate(([v, e]) => window.__fling(v, e), [v, extra ?? {}]), "fling");
const top = () => page.evaluate(() => window.__top());
const wait = (ms) => page.waitForTimeout(ms);
const killGpu = () => { const mine = [...gpuPids()].filter((p) => !gpuBefore.has(p)); mine.forEach((p) => { try { process.kill(p, "SIGKILL"); } catch {} }); return mine; };

try {
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await wait(Number(o.wait));
  // Dismiss a consent banner the way a reader would (it can cover the scene).
  const reject = page.getByRole("button", { name: /reject|decline|only necessary|accept/i });
  if (await reject.count()) await reject.first().click({ timeout: 2000 }).catch(() => {});
  await wait(600);
  const first = await check("baseline");
  const s0 = await scrollState(page);
  if (s0.scroller !== "document") console.log(`  · the page scrolls an inner element (${s0.scroller}, ${s0.max} px) — flicks drive it`);
  if (!first.canvases.length) console.log("  ! no canvas on the page — this probe has nothing to judge (pass for a page without a scene)");

  let deepest = 0;
  const seen = (step) => { deepest = Math.max(deepest, step.y); return step; };
  for (let it = 0; it < (o["no-scroll"] ? 0 : Number(o.iterations)); it++) {
    const t = `#${it}`;
    await fling(0.6); await check(`${t} partial-down`);
    await fling(-0.6); await check(`${t} partial-up`);
    await fling(2.5); await check(`${t} flick-past-first-screen`);
    await fling(-2.5); await wait(100); await check(`${t} flick-back`);
    await fling(9); await fling(9); seen(await check(`${t} bottom`));
    await wait(800);
    await fling(-9); await fling(-9); await fling(-9); await top(); await check(`${t} back-from-bottom`);
    await fling(2.2, { reverseAfterMs: 120, v1: -2.4 }); await check(`${t} reversal-1`);
    await fling(1.4, { reverseAfterMs: 60, v1: -1.6 }); await check(`${t} reversal-2`);
    // The URL bar: the viewport height changes mid-fling (collapse, then expand).
    const p1 = fling(1.2); await wait(80); await page.setViewportSize({ width: vp.width, height: vp.height + 86 }); await p1; await check(`${t} toolbar-collapsed`);
    const p2 = fling(-1.2); await wait(80); await page.setViewportSize({ width: vp.width, height: vp.height }); await p2; await top(); await wait(150); await check(`${t} toolbar-expanded`);
    // An anchor jump away, then the status-bar tap that smooth-scrolls to the top.
    await page.evaluate(() => window.__to(window.__max())); await wait(500); await check(`${t} jump-bottom`);
    // On an inner scroller the smooth return is driven per frame: WebKit dropped an element's
    // scrollTo({ behavior: "smooth" }) here (and iOS's status-bar tap only scrolls the document).
    await page.evaluate(() => {
      const s = window.__scroller();
      if (window.__isDoc(s)) return window.scrollTo({ top: 0, behavior: "smooth" });
      const y0 = s.scrollTop, t0 = performance.now();
      const f = (now) => { const k = Math.min(1, (now - t0) / 600); s.scrollTop = y0 * Math.pow(1 - k, 3); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }); await wait(1200); await check(`${t} status-bar-top`);
    // Sit at the bottom (images decode, the scene is far off screen), then come back slowly.
    await fling(12); await fling(12); await wait(2500);
    for (let k = 0; k < 6; k++) await fling(-3.2);
    await top(); await wait(200); await check(`${t} slow-return`);
  }

  // A long page the flicks never moved: every step judged the first screen — an error, not a pass.
  if (!o["no-scroll"] && Number(o.iterations) > 0 && ((s0.max > 16 && deepest <= 2) || s0.unclaimed)) {
    const why = s0.unclaimed ? `the page reads as one screen, but ${s0.unclaimed} scrolls — the flicks could not move it; nothing below the first screen was checked`
      : `the page is ${s0.max} px longer than its screen but every flick scrolled it 0 px (scroller: ${s0.scroller}) — nothing below the first screen was checked`;
    result.failures.push({ label: "scrolled 0 px", reasons: [why] });
    console.log(`  ✖ ${why}`);
  }

  if (o["gpu-kill"]) {
    if (process.platform !== "darwin") console.log("  ! --gpu-kill is macOS-only — skipped");
    else {
      // At most two kills per run: WebKit's crash-loop guard ends the WebContent
      // process on the third (Safari's "a problem repeatedly occurred").
      await fling(12); await fling(12); await wait(400);
      console.log(`  · killed WebKit GPU process ${killGpu().join(" ") || "(none found)"} with the scene off screen`);
      await wait(1500); for (let k = 0; k < 4; k++) await fling(-4); await top(); await wait(2500);
      await check("gpu killed off screen → back +2.5s");
      console.log(`  · killed WebKit GPU process ${killGpu().join(" ") || "(none found)"} with the scene on screen`);
      await wait(2500); await check("gpu killed on screen +2.5s");
    }
  }

  if (o.faults) {
    const lose = () => page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].find((x) => x.__qaCtx?.getExtension && !x.__qaCtx.isContextLost() && x.getBoundingClientRect().bottom > 0 && x.getBoundingClientRect().top < innerHeight) || [...document.querySelectorAll("canvas")].find((x) => x.__qaCtx?.getExtension && !x.__qaCtx.isContextLost()); const e = c?.__qaCtx.getExtension("WEBGL_lose_context"); if (!e) return "no WebGL canvas"; e.loseContext(); return `lost #${c.dataset.qaId}`; });
    const loseNext = (count, delay) => page.evaluate(([count, delay]) => { __qa.loseNext = { count, delay }; }, [count, delay]);
    for (const delay of [0, 20, 60]) {
      // The REBUILD's own fresh context lost within its first milliseconds — the hole a simple handler leaves.
      await loseNext(1, delay); console.log(`  · ${await lose()} on screen (its rebuild lost @${delay}ms)`);
      await wait(4000); await check(`fault: on screen, rebuild lost @${delay}ms`);
      await fling(12); await fling(12); await wait(500);
      await loseNext(1, delay); console.log(`  · ${await lose()} off screen (its rebuild lost @${delay}ms)`);
      await wait(800); for (let k = 0; k < 4; k++) await fling(-4); await top(); await wait(4000);
      await check(`fault: off screen, rebuild lost @${delay}ms`);
    }
    await loseNext(2, 10); console.log(`  · ${await lose()} — a storm: two rebuilds in a row lost`);
    await wait(6000); await check("fault: storm");
    await fling(2.5); await fling(-2.5); await top(); await wait(300); await check("after the faults, a plain cycle");
  }
} catch (e) {
  result.error = e.message;
  result.failures.push({ label: "probe error", reasons: [e.message] });
  console.log(`  ✖ ${e.message}`);
} finally {
  await browser.close().catch(() => {});
}

result.console = logs.slice(-40);
const total = result.steps.length, failed = result.failures.length;
finish({
  outDir, rel, pass: failed === 0, result: { tool: "webkit-probe", ...result },
  summary: failed ? `${failed} of ${total} steps show a canvas blank, hidden, lost or stopped while on screen in WebKit — see fail-*.png` : `${total} steps: every on-screen canvas stayed shown and drawing in WebKit (${o.device})`,
});
