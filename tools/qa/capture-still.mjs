#!/usr/bin/env node
// A still of the running WebGL scene — the robot form's stand-in for it (the
// robot form ships no scene; crawlers and Lighthouse's robot run see this
// image instead). Loads the page as a PERSON (plain UA — a headless UA would
// get the robot form, which has no scene to capture), waits out the intro,
// hides everything but the canvas and shoots WebP. Hand-written six times on
// production sites before it became a tool.
//
//   node tools/qa/capture-still.mjs --url http://localhost:4500/                       # → report dir, look first
//   node tools/qa/capture-still.mjs --url … --save public/assets/scene-still          # → <name>-desktop.webp / -mobile.webp
//   node tools/qa/capture-still.mjs --url … --transparent                             # keep alpha (canvas composited over the page)
//   node tools/qa/capture-still.mjs --url … --canvas "#hero canvas" --clip            # one canvas of several, its box only
//   node tools/qa/capture-still.mjs --url … --scroll-to "#scene" --hide ".scene-copy" --keep "video" --wait 15000
//
// Sizes: desktop 1440×900 @1×, mobile 412×915 @2×. --wait must cover the
// SCENE's own entrance, not just the loader (12 s caught one scene as an empty
// star field, 22 s caught it whole). Text a scene paints into its own canvas
// shows twice under the HTML copy — --hide its HTML twin. A sticky or scrolled
// canvas is clipped in page coordinates. LOOK at every still before wiring it:
// a still caught mid-intro is the robot's whole first screen.
// Exit 1 when the canvas isn't found or a still comes out blank.
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cli, checkTarget, finish, sleep, PROJECT_ROOT } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { regionStats } from "./lib/image.mjs";

const USAGE = `usage: node tools/qa/capture-still.mjs --url <url> [--save public/assets/<name>] [--device desktop,mobile] [--wait 8000] [--transparent] [--keep <sel>] [--hide <sel>] [--scroll-to <sel>] [--canvas <sel>] [--clip] [--quality 80]`;
const { o, outDir, rel } = cli("capture-still", USAGE, {
  save: { type: "string" }, device: { type: "string", default: "desktop,mobile" }, wait: { type: "string", default: "8000" },
  transparent: { type: "boolean" }, keep: { type: "string" }, quality: { type: "string", default: "80" },
  "scroll-to": { type: "string" }, hide: { type: "string" }, canvas: { type: "string", default: "canvas" }, clip: { type: "boolean" },
  "allow-dev": { type: "boolean" },
});
const DEVICES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false, ua: UA.desktop },
  mobile: { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ua: UA.android },
};
await checkTarget(o.url);
const base = o.save ? resolve(PROJECT_ROOT, o.save) : join(outDir, "still");
mkdirSync(dirname(base), { recursive: true });

const browser = await launch({ headless: true, args: ["--no-sandbox"] });
const stills = [];
let pass = true;
try {
  for (const name of o.device.split(",")) {
    const d = DEVICES[name];
    if (!d) throw new Error(`unknown device ${name}`);
    const page = await browser.newPage();
    await page.setUserAgent(d.ua);
    await page.setViewport(d);
    // A returning visitor: a consent banner that reads a stored choice stays away.
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-consent-v1", "declined"); } catch {} });
    await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
    if (o["scroll-to"]) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center", behavior: "instant" }), o["scroll-to"]);
    await sleep(Number(o.wait));
    if (o.hide) await page.addStyleTag({ content: `${o.hide}{visibility:hidden!important}` });
    const found = await page.evaluate(({ transparent, keep, sel }) => {
      const canvas = document.querySelector(sel);
      if (!canvas) return false;
      if (transparent) {
        document.documentElement.style.background = "transparent";
        for (const el of document.querySelectorAll("*")) el.style.backgroundColor = "transparent";
      }
      // Force-hide everything — an element with its own inline visibility (a
      // text engine, a spring) ignores a body-level hide — then bring back
      // the canvas and its ancestors.
      for (const el of document.querySelectorAll("body *")) el.style.setProperty("visibility", "hidden", "important");
      const show = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) n.style.setProperty("visibility", "visible", "important"); };
      show(canvas);
      if (keep) for (const el of document.querySelectorAll(keep)) show(el);
      const r = canvas.getBoundingClientRect();
      // Page coordinates: the screenshot clip is document-relative.
      return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height), vx: Math.round(r.x), vy: Math.round(r.y) };
    }, { transparent: !!o.transparent, keep: o.keep || null, sel: o.canvas });
    if (!found) throw new Error(`${name}: no "${o.canvas}" on the page after ${o.wait} ms`);
    await sleep(500);
    const clip = o.clip ? { x: found.x, y: found.y, width: found.width, height: found.height } : undefined;
    const png = await page.screenshot({ type: "png", omitBackground: !!o.transparent, ...(clip ? { clip } : {}) });
    const stats = regionStats(png, clip ? { x: 0, y: 0, w: found.width, h: found.height } : { x: Math.max(0, found.vx), y: Math.max(0, found.vy), w: Math.min(d.width, found.width), h: Math.min(d.height, found.height) }, d.deviceScaleFactor);
    const webp = await page.screenshot({ type: "webp", quality: Number(o.quality), omitBackground: !!o.transparent, ...(clip ? { clip } : {}) });
    const file = `${base}-${name}.webp`;
    writeFileSync(file, webp);
    const blank = stats.std < 2;
    if (blank) pass = false;
    const size = clip ? `${found.width}×${found.height}` : `${d.width}×${d.height}`;
    console.log(`  ${blank ? "✖" : "+"} ${rel(file)}  ${size}@${d.deviceScaleFactor}x  ${Math.round(statSync(file).size / 1024)} KB${blank ? "  ← blank (stddev " + stats.std + "): the scene hadn't drawn — raise --wait, or check --canvas" : ""}`);
    stills.push({ device: name, file, size, kb: Math.round(statSync(file).size / 1024), stddev: stats.std, blank });
    await page.close();
  }
} catch (e) {
  console.error(`✖ ${e.message}`); pass = false;
} finally {
  await browser.close();
}
if (!o.save && pass) console.log("  · look at them, then re-run with --save public/assets/<name> to write them into the project");
finish({ outDir, rel, pass, result: { tool: "capture-still", url: o.url, stills }, summary: pass ? "stills written — look at each before wiring it into the robot form" : "no usable still — see above" });
