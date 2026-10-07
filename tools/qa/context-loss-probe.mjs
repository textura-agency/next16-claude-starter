#!/usr/bin/env node
// Context-loss probe: does a WebGL scene come back after the reader was
// elsewhere — plainly, and after the browser took its WebGL context away?
// iOS drops WebGL contexts under memory pressure (decoding big images while
// the scene is off screen is enough); a page that never rebuilds shows a
// permanent blank where its scene was. Seen on a production site as "scroll the
// whole page and back → the hero is gone"; reproduced here with
// WEBGL_lose_context, and the fix (preventDefault on webglcontextlost; when the
// scene nears the viewport / the tab returns / pageshow, check isContextLost()
// and rebuild on a fresh context at rest, ≥ 1 s apart, 3 tries; release the
// context on teardown) passes it.
//
//   node tools/qa/context-loss-probe.mjs --url http://localhost:4500/
//   node tools/qa/context-loss-probe.mjs --url … --sel "#hero canvas" --cycles 4 --wait 11000
//
// iPhone emulation in Chrome (GPU on). It follows ONE canvas: --sel, else the
// largest canvas on screen after --wait (a rebuild that replaces the element is
// followed to its successor in the same place). Steps:
//   1. away from the scene (to the far end of the page) and back, --cycles times
//   2. context lost while away, never restored (the iOS case) → back
//   3. lost and restored by the browser while away → back
//   4. lost while on screen
//   5. one plain cycle after all that
// After each return it requires: a canvas there, context not lost, draw calls
// in 500 ms, and a lit drawing buffer (≥ 40 % of the first load's) — the
// buffer is read back because the probe forces preserveDrawingBuffer.
// Also prints how long the scene took to show a lit frame after the return.
// Exit 1 when any return fails. Shots in the report dir — look at them.
import { join } from "node:path";
import { cli, checkTarget, finish, sleep } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { CANVAS_PROBE } from "./lib/canvas-probe.mjs";
import { installScroller, zeroScroll } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/context-loss-probe.mjs --url <url> [--sel <canvas selector>] [--cycles 4] [--wait 11000] [--grace 2500]`;
const { o, outDir, rel } = cli("context-loss-probe", USAGE, {
  sel: { type: "string" }, cycles: { type: "string", default: "4" }, wait: { type: "string", default: "11000" },
  grace: { type: "string", default: "2500" }, "allow-dev": { type: "boolean" },
});
await checkTarget(o.url);
const grace = Number(o.grace);

const browser = await launch({ headless: true });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await page.setUserAgent(UA.iphone);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await page.evaluateOnNewDocument(CANVAS_PROBE, { preserve: true });
await installScroller(page);
const logs = [];
page.on("console", (m) => { if (/error|warn/i.test(m.type())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 200)); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message.slice(0, 200)));

const state = () => page.evaluate(async () => {
  const t = __qa.targetInfo();
  if (!t) return { present: false, scrollY: Math.round(window.__sy()) };
  const draws = await __qa.drawsOver(500);
  return { present: true, ...t, drawsPer500ms: draws, readback: __qa.readback(), scrollY: Math.round(window.__sy()) };
});
// Stepped, like a finger: 450 px every 40 ms (Lenis follows native scroll),
// through the page's scroller (lib/scroller.mjs). "Away" on a long page that
// does not move is an error: every later "back" would be judged without the
// scene ever having left the screen.
const scrollTo = async (where) => {
  const r = await page.evaluate(async (where) => {
    window.__scroller(true);
    const max = window.__max(), from = Math.round(window.__sy());
    let goal;
    if (where === "home") { const t = __qa.target(); goal = t ? Math.max(0, Math.min(max, window.__yOf(t) - 40)) : 0; }
    else { const b = __qa.targetBox; goal = b && b.y + b.h / 2 > (max + window.__vh()) / 2 ? 0 : max; }
    const y = Math.round(await window.__stepTo(goal, 450, 40));
    return { from: { y: from, max: Math.round(max), unclaimed: max <= 16 ? window.__unclaimed() : null }, to: { y, max: Math.round(max), scroller: window.__describe() }, goal: Math.round(goal) };
  }, where);
  const err = zeroScroll(r.from, r.to, r.goal, where === "away" || Math.abs(r.goal - r.from.y) > 2);
  if (err && !result.scrollError) { result.scrollError = err; pass = false; console.log(`  ✖ scrolling ${where}: ${err}`); }
  return r.to.y;
};

const result = { url: o.url, sel: o.sel || null, steps: [] };
let pass = true, base;
const record = async (label, expectDraw) => {
  const s = await state();
  let reasons = [];
  if (expectDraw) {
    if (!s.present) reasons.push("no canvas");
    else {
      if (s.lost) reasons.push("context lost");
      if (s.type !== "offscreen" && !(s.drawsPer500ms > 0) && base.drawsPer500ms > 0) reasons.push("no draws");
      if (s.readback.lit >= 0 && base.readback.lit > 0 && s.readback.lit < base.readback.lit * 0.4 && s.readback.std < base.readback.std * 0.4) reasons.push(`buffer blank (lit ${s.readback.lit} vs ${base.readback.lit})`);
      if (s.opacity < 0.05 || s.flags.length) reasons.push(`hidden (${s.opacity < 0.05 ? `opacity ${s.opacity}` : s.flags.join(", ")})`);
    }
  }
  const ok = reasons.length === 0;
  if (!ok) pass = false;
  result.steps.push({ label, ok, reasons, ...s });
  console.log(`  ${expectDraw ? (ok ? "✔" : "✖") : "·"} ${label.padEnd(36)} ${s.present ? `y=${s.scrollY} draws/500ms ${s.drawsPer500ms} lit ${s.readback.lit} ${s.lost ? "LOST " : ""}${s.replaced ? `(rebuilt canvas #${s.id}) ` : ""}` : "no canvas "}${reasons.length ? "← " + reasons.join("; ") : ""}`);
  return ok;
};
const lose = (restoreMs) => page.evaluate((r) => __qa.lose(r), restoreMs ?? null);
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) });
// Time from arriving back to a lit frame on the target.
const timeToLit = () => page.evaluate(async () => {
  const t0 = performance.now();
  while (performance.now() - t0 < 5000) {
    const r = __qa.readback();
    const t = __qa.targetInfo();
    if (t && !t.lost && r.lit > 0.002) return Math.round(performance.now() - t0);
    await new Promise((res) => setTimeout(res, 16));
  }
  return -1;
});

try {
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await sleep(Number(o.wait));
  const picked = await page.evaluate((sel) => __qa.pick(sel), o.sel || null);
  if (!picked) { console.error(`✖ no canvas matches "${o.sel || "canvas"}"`); await browser.close(); process.exit(2); }
  if (picked.type !== "webgl" && picked.type !== "webgl2" && picked.type !== "offscreen") console.log(`  ! the target canvas has a "${picked.type}" context — this probe is about WebGL`);
  base = await state();
  result.baseline = base;
  console.log(`  following canvas #${base.id} (${base.type}, buffer ${base.attr}) · baseline draws/500ms ${base.drawsPer500ms}, lit ${base.readback.lit}`);
  if (base.readback.lit <= 0 && base.type !== "offscreen") console.log("  ! the buffer reads unlit at baseline — the lit check is off; draws and context state still judge");
  await shot("0-baseline");

  for (let i = 1; i <= Number(o.cycles); i++) {
    await scrollTo("away"); await sleep(1200);
    await record(`cycle ${i}: away`, false);
    await scrollTo("home"); await sleep(800);
    await record(`cycle ${i}: back`, true);
  }
  await shot("1-after-cycles");

  await scrollTo("away"); await sleep(800);
  console.log(`  · lose context while away (no restore): ${await lose()}`);
  await sleep(1500);
  await record("lost (no restore), away", false);
  await scrollTo("home");
  result.redrawMs = await timeToLit();
  console.log(`  · lit again ${result.redrawMs >= 0 ? `${result.redrawMs} ms after the return` : "— never, within 5 s"}`);
  await sleep(grace);
  await record("lost (no restore) → back", true);
  await shot("2-after-loss");

  await scrollTo("away");
  console.log(`  · lose + browser restore while away: ${await lose(300)}`);
  await sleep(1500);
  await record("lost + restored, away", false);
  await scrollTo("home"); await sleep(grace);
  await record("lost + restored → back", true);

  await sleep(1200);
  console.log(`  · lose context on screen: ${await lose()}`);
  await sleep(grace + 500);
  await record("lost while on screen", true);
  await shot("3-after-onscreen-loss");

  await scrollTo("away"); await sleep(1000);
  await scrollTo("home"); await sleep(800);
  await record("final plain cycle", true);
} finally {
  await browser.close();
}
result.console = logs.slice(0, 20);
if (logs.length) console.log(`  console: ${logs.slice(0, 3).join(" | ")}`);
finish({
  outDir, rel, pass, result: { tool: "context-loss-probe", ...result },
  summary: result.scrollError ? `ERROR: ${result.scrollError}` : pass ? "the scene comes back after every trip away and every context loss" : "the scene does not come back — handle webglcontextlost (preventDefault), and rebuild on a fresh context when it nears the viewport / the tab returns",
});
