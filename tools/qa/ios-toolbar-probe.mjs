#!/usr/bin/env node
// iOS toolbar probe. Safari's URL bar collapses and expands while you scroll,
// changing the viewport HEIGHT many times a minute. A scene sized 100dvh /
// fixed inset-0 / innerHeight follows it: the renderer reallocates its buffer
// (cleared → a blank frame), re-randomises, or — with an r3f
// `frameloop="never"` prop re-applied on re-render — stays black. Seen on
// three production sites as "the scene flickers on scroll".
//
//   node tools/qa/ios-toolbar-probe.mjs --url http://localhost:4500/
//   node tools/qa/ios-toolbar-probe.mjs --url … --sel "#hero canvas" --scroll 0.1
//
// Emulates an iPhone (390 wide, DPR 3, touch, Safari UA) in Chrome, scrolls to
// --scroll of the page, then steps the height through --heights at a fixed
// width. It follows ONE canvas the whole way — --sel, else the largest canvas
// on screen at the start (re-found in place if a rebuild replaces it) — and
// per step records its buffer (width/height attributes), its box and its
// parent's box, `resize` events, canvas attribute writes, size messages posted
// to a Worker (an OffscreenCanvas scene resized in its worker), its draw calls,
// and two shots (50 ms and 400 ms after the change) scored for blankness
// inside its box (luminance stddev < 35 % of the pre-change shot = BLANK).
// Shots isolate canvases (everything else visibility:hidden) — --no-isolate to
// see the page as is. Then it rotates (--rotate) and expects the SAME canvas
// to follow the width, and rotates back expecting it to still draw.
//
// PASS = over the height steps no buffer/box change, no worker size message,
// no blank shot, no stalled loop; the rotation re-sized; the loop survived the
// second resize. Exit 1 on FAIL. LOOK at the shots in the report dir.
//
// Known artefact: emulated height steps also shrink CSS `lvh`/`vh`, which a
// real iPhone's toolbar never does. A canvas sized in pure CSS `100lvh` can
// FAIL here and be fine on a phone — the stable-viewport helper (JS-measured
// large viewport, re-measured on touch devices only when the WIDTH changes)
// passes both. Confirm a lvh-only FAIL in webkit-probe or on a device.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, checkTarget, finish, sleep } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { CANVAS_PROBE, isolate } from "./lib/canvas-probe.mjs";
import { regionStats } from "./lib/image.mjs";
import { installScroller, scrollToFraction } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/ios-toolbar-probe.mjs --url <url> [--sel <canvas selector>] [--wait 9000] [--scroll 0.3] [--heights 844,760,844,760,844,700,844] [--rotate 844x390] [--no-isolate]`;
const { o, outDir, rel } = cli("ios-toolbar-probe", USAGE, {
  wait: { type: "string", default: "9000" }, scroll: { type: "string", default: "0.3" },
  heights: { type: "string", default: "844,760,844,760,844,700,844" }, sel: { type: "string" },
  "no-isolate": { type: "boolean" }, rotate: { type: "string", default: "844x390" }, "allow-dev": { type: "boolean" },
});
const HEIGHTS = o.heights.split(",").map(Number);
const [RW, RH] = o.rotate.split("x").map(Number);
const W = 390, DPR = 3;
await checkTarget(o.url);

const browser = await launch({ headless: true });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
const metrics = (w, h) => cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: DPR, mobile: true });
await page.setUserAgent(UA.iphone);
await metrics(W, HEIGHTS[0]);
await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await page.evaluateOnNewDocument(CANVAS_PROBE, { preserve: true });
await installScroller(page);

const counters = () => page.evaluate(() => ({ resize: __qa.resize, attr: __qa.attr, workerSize: __qa.workerSize }));
const tinfo = () => page.evaluate(() => ({ t: __qa.targetInfo(), inner: `${innerWidth}x${innerHeight}`, scrollY: Math.round(window.__sy()) }));
const delta = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - a[k]]));
const shoot = async (name, rect) => {
  if (!o["no-isolate"]) await isolate(page, true, "canvas");
  const buf = await page.screenshot({ type: "png" });
  if (!o["no-isolate"]) await isolate(page, false);
  writeFileSync(join(outDir, `${name}.png`), buf);
  return regionStats(buf, rect, DPR);
};
const visibleRect = (t, vw, vh) => {
  const y0 = Math.max(0, t.box.y), y1 = Math.min(vh, t.box.y + t.box.h);
  const x0 = Math.max(0, t.box.x), x1 = Math.min(vw, t.box.x + t.box.w);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
};

let fail = false;
const result = { url: o.url, sel: o.sel || null, steps: [] };
try {
  await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
  await sleep(Number(o.wait));
  // Through the page's scroller (an inner full-screen div when <html>/<body> are locked).
  const sc = await scrollToFraction(page, Number(o.scroll), { settle: 1500 });
  result.scroll = sc;
  if (sc.error) { fail = true; console.log(`  ✖ --scroll ${o.scroll}: ${sc.error}`); }
  else if (sc.scroller !== "document") console.log(`  · the page scrolls an inner element (${sc.scroller}) — scrolled it to y=${sc.y} of ${sc.max}`);
  const picked = await page.evaluate((sel) => __qa.pick(sel), o.sel || null);
  if (!picked) { console.error(`✖ no canvas matches "${o.sel || "canvas"}" on the page`); await browser.close(); process.exit(2); }
  const all = await page.evaluate(() => __qa.all());
  if (all.length > 1 && !o.sel) console.log(`  ! ${all.length} canvases on the page — following #${picked.id} (${picked.box.w}x${picked.box.h}); pass --sel to choose another`);
  const before = await tinfo();
  const b = before.t;
  const drewBefore = await page.evaluate(() => __qa.drawsOver(400));
  // The shot region: the part of the canvas inside the SMALLEST height step.
  const rect = visibleRect(b, W, Math.min(...HEIGHTS));
  const ref = await shoot("step-0-ref", rect);
  console.log(`  following canvas #${b.id}: buffer ${b.attr}, box ${b.box.w}x${b.box.h}@${b.box.y}, parent ${b.parent?.w}x${b.parent?.h}, ${b.type}, ${drewBefore} draws/400ms, ref stddev ${ref.std}`);
  if (b.type === "offscreen") console.log("  · an OffscreenCanvas (worker) scene: draws aren't countable here — worker size messages and shots judge it");
  result.before = { ...before, drewBefore, ref };

  for (const [i, h] of HEIGHTS.slice(1).entries()) {
    const c0 = await counters();
    const d0 = (await tinfo()).t?.draws ?? 0;
    await metrics(W, h);
    await sleep(50);
    const early = await shoot(`step-${i + 1}-h${h}-50ms`, rect);
    await sleep(350);
    const late = await shoot(`step-${i + 1}-h${h}-400ms`, rect);
    const now = await tinfo();
    const t = now.t;
    const d = delta(c0, await counters());
    const draws = (t?.draws ?? 0) - d0;
    const changed = !t ? ["the canvas is gone"] : [
      t.attr !== b.attr && `buffer ${b.attr} → ${t.attr}`,
      (t.box.w !== b.box.w || t.box.h !== b.box.h) && `box ${b.box.w}x${b.box.h} → ${t.box.w}x${t.box.h}`,
      (t.parent?.h !== b.parent?.h || t.parent?.w !== b.parent?.w) && `parent ${b.parent?.w}x${b.parent?.h} → ${t.parent?.w}x${t.parent?.h}`,
      t.replaced && "the canvas element was replaced",
    ].filter(Boolean);
    const blank = [early, late].some((x) => x.std < ref.std * 0.35);
    const stalled = drewBefore > 0 && draws === 0;
    const ok = changed.length === 0 && d.attr === 0 && d.workerSize === 0 && !blank && !stalled;
    if (!ok) fail = true;
    result.steps.push({ height: h, inner: now.inner, counters: d, draws, changed, early, late, blank, stalled, ok });
    console.log(`${ok ? "  ✔" : "  ✖"} h ${h}: ${changed.length ? changed.join(", ") : "canvas unchanged"} · attr writes ${d.attr} · worker size msgs ${d.workerSize} · resize events ${d.resize} · draws ${draws}${stalled ? " STALLED" : ""} · stddev 50ms ${early.std} / 400ms ${late.std}${blank ? " BLANK" : ""}`);
  }

  // Rotation: the width changes — the SAME canvas must follow.
  const r0 = await counters();
  await metrics(RW, RH);
  await sleep(1200);
  const rot = await tinfo();
  const rd = delta(r0, await counters());
  const rdraws = await page.evaluate(() => __qa.drawsOver(400));
  const rt = rot.t;
  const rshot = rt ? await shoot("step-rotate", visibleRect(rt, RW, RH)) : { std: 0 };
  const rstalled = drewBefore > 0 && rdraws === 0;
  const followed = rt && rt.box.w >= RW - 2 ? true : rt && rt.box.w !== b.box.w;
  const resized = rt && followed && (rd.attr > 0 || rd.workerSize > 0 || rt.attr !== b.attr) && !rstalled;
  if (!resized || rshot.std < ref.std * 0.35) fail = true;
  result.rotate = { inner: rot.inner, target: rt, counters: rd, draws: rdraws, shot: rshot, resized };
  console.log(`${resized ? "  ✔" : "  ✖"} rotate → ${rot.inner}: canvas #${rt?.id} buffer ${rt?.attr} box ${rt?.box.w}x${rt?.box.h} · attr writes ${rd.attr} · worker size msgs ${rd.workerSize} · draws ${rdraws}${rstalled ? " STALLED" : ""} · stddev ${rshot.std}`);

  // And back — a second real resize (one scene's loop died on exactly this).
  const k0 = await counters();
  await metrics(W, HEIGHTS[0]);
  await sleep(1200);
  const back = await tinfo();
  const bd = delta(k0, await counters());
  const bdraws = await page.evaluate(() => __qa.drawsOver(400));
  const bshot = back.t ? await shoot("step-rotate-back", visibleRect(back.t, W, HEIGHTS[0])) : { std: 0 };
  const bstalled = drewBefore > 0 && bdraws === 0;
  const bblank = bshot.std < ref.std * 0.35;
  if (bstalled || bblank) fail = true;
  result.rotateBack = { inner: back.inner, counters: bd, draws: bdraws, shot: bshot };
  console.log(`${bstalled || bblank ? "  ✖" : "  ✔"} rotate back → ${back.inner}: draws ${bdraws}${bstalled ? " STALLED" : ""} · stddev ${bshot.std}${bblank ? " BLANK" : ""}`);
} finally {
  await browser.close();
}
finish({
  outDir, rel, pass: !fail, result: { tool: "ios-toolbar-probe", ...result },
  summary: result.scroll?.error ? `ERROR: ${result.scroll.error}` : fail
    ? "the scene reacts to height-only (toolbar) resizes, goes blank or stops drawing — size scene boxes at the large viewport, re-measure on touch devices only on a WIDTH change, skip same-size resizes, draw at once on a real one"
    : "toolbar-height changes leave the scene alone; rotation still resizes it",
});
