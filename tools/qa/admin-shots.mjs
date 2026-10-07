#!/usr/bin/env node
// Screenshots of the site's own screens for the CMS's editor's guide
// (/admin/guide — the `payload-admin` skill). One shot per guide entry: the
// screen a sidebar item edits, shot the way a person sees it, so the guide can
// put it beside the entry.
//
//   node tools/qa/admin-shots.mjs --url http://localhost:4500/ --shots "hero=#hero,footer=footer"
//   node tools/qa/admin-shots.mjs --url … --shots "hero=#hero,not-found=/404,terms=/terms" --save public/admin-guide
//   node tools/qa/admin-shots.mjs --url … --shots "pricing=/pricing#plans" --hide ".promo-bar" --wait 6000
//
// Each shot is `name=target`: a CSS selector on the home page, a `/path` (the
// top of that page), or `/path#selector`. 1440 × 900 at a 1200 px output
// (deviceScaleFactor 1200/1440), a person's UA (a headless UA gets the robot
// form), a stored consent so the cookie banner stays away and the analytics
// beacon sends nothing, Next's dev overlay hidden. The section is scrolled into
// view through the page's scroller and given --settle ms to finish entering.
// Without --save the WebPs go to the report dir — LOOK at each, then --save.
// Exit 1 when a target isn't found or a shot comes out blank.
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cli, checkTarget, finish, sleep, PROJECT_ROOT } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { regionStats } from "./lib/image.mjs";
import { installScroller, scrollToSelector } from "./lib/scroller.mjs";

const USAGE = `usage: node tools/qa/admin-shots.mjs --url <url> --shots "name=target,…" [--save public/admin-guide] [--wait 4000] [--settle 2500] [--hide <sel>] [--quality 80]`;
const { o, outDir, rel } = cli("admin-shots", USAGE, {
  shots: { type: "string" }, save: { type: "string" }, wait: { type: "string", default: "4000" },
  settle: { type: "string", default: "2500" }, hide: { type: "string" }, quality: { type: "string", default: "80" },
});
if (!o.shots) { console.log(USAGE); process.exit(2); }

const WIDTH = 1440, HEIGHT = 900, OUT_WIDTH = 1200;
// The starter's consent key (src/components/common/Cookie/consent-flag.ts): a
// decided visitor — no banner, no analytics.
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false });
const HIDE = ["nextjs-portal", "[data-nextjs-toast]", "[data-cookie-banner]", ".cookie-banner", o.hide].filter(Boolean).join(",");

const shots = o.shots.split(",").map((pair) => {
  const at = pair.indexOf("=");
  if (at < 1) throw new Error(`bad --shots entry "${pair}" — want name=target`);
  const name = pair.slice(0, at).trim();
  const target = pair.slice(at + 1).trim();
  const [path, selector] = target.startsWith("/") ? [target.split("#")[0], target.split("#")[1]] : ["/", target];
  return { name, path, selector };
});

await checkTarget(o.url);
const dir = o.save ? resolve(PROJECT_ROOT, o.save) : outDir;
mkdirSync(dir, { recursive: true });

const browser = await launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
let pass = true;
try {
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setUserAgent(UA.desktop);
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: OUT_WIDTH / WIDTH });
    await page.evaluateOnNewDocument((value) => { try { localStorage.setItem("cookie-consent-v1", value); } catch {} }, CONSENT);
    await installScroller(page);
    try {
      await page.goto(new URL(shot.path, o.url).href, { waitUntil: "load", timeout: 90_000 });
      await sleep(Number(o.wait));
      await page.addStyleTag({ content: `${HIDE}{display:none!important}` });
      if (shot.selector) {
        let sc = await scrollToSelector(page, shot.selector, { block: "start" });
        for (let i = 0; i < 3 && sc?.error; i++) { await sleep(2000); sc = await scrollToSelector(page, shot.selector, { block: "start" }); }
        if (!sc) throw new Error(`no "${shot.selector}" on ${shot.path}`);
        if (sc.error) throw new Error(`${shot.selector}: ${sc.error}`);
      }
      await sleep(Number(o.settle));
      const png = await page.screenshot({ type: "png" });
      const stats = regionStats(png, { x: 0, y: 0, w: WIDTH, h: HEIGHT }, OUT_WIDTH / WIDTH);
      const file = join(dir, `${shot.name}.webp`);
      writeFileSync(file, await page.screenshot({ type: "webp", quality: Number(o.quality) }));
      const blank = stats.std < 2;
      if (blank) pass = false;
      const kb = Math.round(statSync(file).size / 1024);
      console.log(`  ${blank ? "✖" : "+"} ${rel(file)}  ${OUT_WIDTH}×${Math.round(HEIGHT * OUT_WIDTH / WIDTH)}  ${kb} KB${blank ? "  ← blank: raise --wait / --settle" : ""}`);
      results.push({ ...shot, file, kb, blank });
    } catch (e) {
      console.error(`  ✖ ${shot.name}: ${e.message}`); pass = false;
      results.push({ ...shot, error: e.message });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (!o.save && pass) console.log("  · look at each, then re-run with --save public/admin-guide");
finish({ outDir, rel, pass, result: { tool: "admin-shots", url: o.url, shots: results }, summary: pass ? "shots written — look at each before the guide uses it" : "some shots failed — see above" });
