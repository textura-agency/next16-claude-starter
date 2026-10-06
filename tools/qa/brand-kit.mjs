#!/usr/bin/env node
// The brand kit: the favicon set and the share image, rendered from the
// brand's own mark and the running hero. Sites cut from a starter tend to ship
// its generic icons and a placeholder share card for months — on one set of
// production sites, 29 shipped the identical starter icons and a 900×600
// placeholder card, which every chat app showed as the link preview.
//
//   node tools/qa/brand-kit.mjs --icon src/assets/brand/mark.svg --url http://localhost:4500/
//   node tools/qa/brand-kit.mjs --icon mark.svg --skip-og --bg "#0b0b0f"
//   node tools/qa/brand-kit.mjs --url … --skip-icons --og-wait 12000 --og-hide ".cookie-banner"
//   node tools/qa/brand-kit.mjs --icon mark.svg --url … --dry          # write into the report dir only, to look first
//
// --icon is the MARK, drawn by hand from the site's logo (judgement, not
// generated): a square SVG with a viewBox that reads at 16 px — the logomark
// or a monogram, never the full wordmark. Chrome renders it, so anything the
// browser draws works (gradients, filters, embedded fonts).
//
// Writes into public/ (or the report dir with --dry):
//   icon.svg                    the mark itself (modern browsers take the vector)
//   favicon.ico                 16/32/48 PNGs in one ICO
//   favicon-16x16.png, favicon-32x32.png
//   apple-icon-180x180.png      flattened on --bg (iOS ignores alpha), 12 % safe padding
//   android-icon-{36…192}.png, icon-512.png, icon-maskable-512.png (10 % safe zone)
//   the share image             1200×630 capture of the running hero, as a
//                               returning visitor (consent banner pre-dismissed),
//                               at the path siteConfig.ogImage names (.png/.jpg)
// The web manifest is NOT written: src/app/manifest.ts builds it from
// siteConfig (name, colours). A src/app/favicon.ico would win /favicon.ico over
// these — the tool warns if one exists.
// Flags: --og-width 1600 renders a hero laid out for wide screens at that width
// and scales it to 1200×630; --icon-full draws apple/maskable edge to edge (a
// mark that already IS a filled square); --og-scroll <px>; --og-quality 88.
// LOOK at the share image and the 16/32 px icons: a capture mid-loader is the
// card every chat app shows. Exit 1 if the share image comes out blank.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { cli, checkTarget, finish, sleep, PROJECT_ROOT } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";
import { regionStats } from "./lib/image.mjs";

const USAGE = `usage: node tools/qa/brand-kit.mjs --icon <mark.svg> --url <url> [--bg #hex] [--og-wait 9000] [--og-hide <sel>] [--og-width 1200] [--og-scroll px] [--icon-full] [--skip-og] [--skip-icons] [--dry]`;
const { o, outDir, rel } = cli("brand-kit", USAGE, {
  icon: { type: "string" }, bg: { type: "string" }, "og-wait": { type: "string", default: "9000" }, "og-hide": { type: "string" },
  "og-scroll": { type: "string" }, "og-quality": { type: "string", default: "88" }, "og-width": { type: "string", default: "1200" },
  "icon-full": { type: "boolean" }, "skip-og": { type: "boolean" }, "skip-icons": { type: "boolean" }, dry: { type: "boolean" }, "allow-dev": { type: "boolean" },
}, { needUrl: false });
if ((!o["skip-icons"] && !o.icon) || (!o["skip-og"] && !o.url)) { console.log(USAGE); process.exit(2); }

// siteConfig is TypeScript; read the two values the kit needs from its source.
const siteSrc = (() => { try { return readFileSync(join(PROJECT_ROOT, "src/lib/site.ts"), "utf8"); } catch { return ""; } })();
const ogPath = siteSrc.match(/ogImage:\s*["'`]([^"'`]+)["'`]/)?.[1] || "/open-graph.jpg";
const bg = o.bg || siteSrc.match(/backgroundColor:\s*["'`](#[0-9a-fA-F]{3,8})["'`]/)?.[1] || "#000000";
const pub = o.dry ? join(outDir, "public") : join(PROJECT_ROOT, "public");
if (o.url) await checkTarget(o.url);

const written = [];
function write(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  written.push(rel(path));
  console.log(`  + ${rel(path)}  ${Math.max(1, Math.round(statSync(path).size / 1024))} KB`);
}
// ICO = header + directory + PNG payloads (PNG-in-ICO, every browser since IE).
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

const browser = await launch({ headless: true, args: ["--no-sandbox"] });
// One PNG of the mark at `size`; `pad` = the safe-zone fraction per side.
async function render(svg, size, { fill = null, pad = 0 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  const inner = Math.round(size * (1 - pad * 2));
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${fill || "transparent"}"><img src="${src}" width="${inner}" height="${inner}" style="display:block"></body></html>`);
  await page.evaluate(() => document.images[0].decode());
  const png = Buffer.from(await page.screenshot({ omitBackground: !fill, type: "png" }));
  await page.close();
  return png;
}

let pass = true, og = null;
try {
  if (!o["skip-icons"]) {
    const svg = readFileSync(isAbsolute(o.icon) ? o.icon : resolve(process.cwd(), o.icon), "utf8");
    if (!/viewBox/.test(svg)) console.log("  ! the SVG has no viewBox — it may not scale");
    write(join(pub, "icon.svg"), svg);
    const small = [];
    for (const size of [16, 32, 48]) small.push({ size, buf: await render(svg, size) });
    write(join(pub, "favicon.ico"), ico(small));
    write(join(pub, "favicon-16x16.png"), small[0].buf);
    write(join(pub, "favicon-32x32.png"), small[1].buf);
    write(join(pub, "apple-icon-180x180.png"), await render(svg, 180, { fill: bg, pad: o["icon-full"] ? 0 : 0.12 }));
    for (const size of [36, 48, 72, 96, 144, 192]) write(join(pub, `android-icon-${size}x${size}.png`), await render(svg, size));
    write(join(pub, "icon-512.png"), await render(svg, 512));
    write(join(pub, "icon-maskable-512.png"), await render(svg, 512, { fill: bg, pad: o["icon-full"] ? 0 : 0.1 }));
    if (existsSync(join(PROJECT_ROOT, "src/app/favicon.ico"))) console.log("  ! src/app/favicon.ico exists — Next links it ahead of these and it wins /favicon.ico: delete it");
    if (existsSync(join(PROJECT_ROOT, "public/manifest.json"))) console.log("  ! public/manifest.json exists next to src/app/manifest.ts — delete the static one");
  }
  if (!o["skip-og"]) {
    const page = await browser.newPage();
    await page.setUserAgent(UA.desktop);  // a person: the robot form has no scene to show
    const w = Number(o["og-width"]);
    await page.setViewport({ width: w, height: Math.round((w * 630) / 1200), deviceScaleFactor: 1200 / w });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-consent-v1", "declined"); } catch {} });
    await page.goto(o.url, { waitUntil: "load", timeout: 90_000 });
    if (o["og-scroll"]) await page.evaluate((y) => scrollTo(0, y), Number(o["og-scroll"]));
    await sleep(Number(o["og-wait"]));
    if (o["og-hide"]) await page.addStyleTag({ content: `${o["og-hide"]}{visibility:hidden!important}` });
    await sleep(400);
    const png = Buffer.from(await page.screenshot({ type: "png" }));
    const stats = regionStats(png, { x: 0, y: 0, w, h: Math.round((w * 630) / 1200) }, 1200 / w);
    const jpg = /\.jpe?g$/i.test(ogPath);
    const buf = jpg ? Buffer.from(await page.screenshot({ type: "jpeg", quality: Number(o["og-quality"]) })) : png;
    write(join(pub, ogPath.replace(/^\//, "")), buf);
    og = { path: ogPath, stddev: stats.std };
    if (stats.std < 3) { pass = false; console.log(`  ✖ the share image is nearly uniform (stddev ${stats.std}) — a loader or a blank hero; raise --og-wait`); }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`
Wire it:
  src/lib/site.ts            ogImage: "${ogPath}" (1200×630), ogImageAlt: what the image shows
  src/app/manifest.ts        add { src: "/icon-512.png", sizes: "512x512", type: "image/png" } and
                             { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  generate-page-metadata.ts  icons already list icon.svg, favicon.ico, the 16/32 PNGs and the apple icon
Look at the share image and the 16/32 px icons before committing.`);
finish({ outDir, rel, pass, result: { tool: "brand-kit", url: o.url || null, dry: !!o.dry, bg, written, og }, summary: pass ? `${written.length} files written${o.dry ? " (dry: report dir only)" : " into public/"}` : "the share image is blank — see above" });
