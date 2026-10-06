#!/usr/bin/env node
// Motion-off and robot-form check. Two failures that no score shows:
//
//  1. A HUNG PAGE for anyone who prefers reduced motion. A looping
//     react-spring (`loop: true`) under `skipAnimation` completes in 0 ms and
//     restarts in the same tick, forever — the tab is dead. On the robot form
//     Lighthouse reports it only as PAGE_HUNG. Seen live on several production
//     sites. Fix: `loop: !useMotionOff()`. A milder form — a loop that restarts
//     instantly but yields — costs ~300 ms of main thread per load.
//  2. COPY CRAWLERS CAN'T READ. A crawler that runs no JavaScript (GPTBot,
//     ClaudeBot, PerplexityBot…) reads the served HTML only. A route-level
//     `app/loading.tsx` wraps the page in Suspense and streams it into
//     `<div hidden>` revealed by a script — the crawler gets a page whose h1 is
//     hidden. Measured: after deleting an empty loading.tsx, hidden text went
//     394 → 0 and 1,619 → 0 chars on two sites.
//
//   node tools/qa/check-motion.mjs --url http://localhost:4500/
//   node tools/qa/check-motion.mjs --url … --wait 5000
//
// For each of: a person with prefers-reduced-motion, Googlebot, GPTBot — load,
// wait, then ask the page for `1 + 1` with a 5 s deadline (hung = FAIL), and
// count main-thread long-task time over 3 s of rest (> 200 ms = WARN: a loop
// restarting under motion-off). Then fetch the raw HTML as Googlebot and as
// GPTBot (no JS) and check the first <h1> is not inside a `hidden` element and
// how much text sits in hidden segments. Exit 1 on a hang or a hidden h1.
import { cli, checkTarget, finish, sleep } from "./lib/run.mjs";
import { launch, UA } from "./lib/chrome.mjs";

const USAGE = `usage: node tools/qa/check-motion.mjs --url <url> [--wait 3000]`;
const { o, outDir, rel } = cli("check-motion", USAGE, { wait: { type: "string", default: "3000" }, "allow-dev": { type: "boolean" } });
await checkTarget(o.url);

const FORMS = [
  { name: "reduced motion", ua: UA.desktop, reduce: true },
  { name: "Googlebot", ua: UA.googlebot, reduce: false },
  { name: "GPTBot", ua: UA.gptbot, reduce: false },
];
let pass = true;
const forms = [];
const browser = await launch({ headless: true });
try {
  for (const f of FORMS) {
    const page = await browser.newPage();
    await page.setUserAgent(f.ua);
    if (f.reduce) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument(() => {
      window.__lt = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt += e.duration; }).observe({ type: "longtask", buffered: true }); } catch {}
    });
    const row = { form: f.name };
    try {
      await page.goto(o.url, { waitUntil: "load", timeout: 30_000 });
      await sleep(Number(o.wait));
      const t0 = Date.now();
      await Promise.race([page.evaluate(() => 1 + 1), new Promise((_, rej) => setTimeout(() => rej(new Error("no answer in 5 s")), 5000))]);
      row.answerMs = Date.now() - t0;
      const lt0 = await page.evaluate(() => window.__lt);
      await sleep(3000);
      row.restLongTaskMs = Math.round((await page.evaluate(() => window.__lt)) - lt0);
      row.robotForm = await page.evaluate(() => location.pathname.includes("robot") || document.documentElement.dataset.robot !== undefined || !!document.querySelector("[data-robot]"));
      row.verdict = row.restLongTaskMs > 200 ? "busy at rest" : "responsive";
      console.log(`  ${row.restLongTaskMs > 200 ? "!" : "✔"} ${f.name.padEnd(15)} responsive (${row.answerMs} ms) · long tasks over 3 s of rest: ${row.restLongTaskMs} ms${row.restLongTaskMs > 200 ? "  ← something restarts in a loop with motion off (gate loops on useMotionOff())" : ""}`);
    } catch (e) {
      row.verdict = "HUNG"; row.error = e.message; pass = false;
      console.log(`  ✖ ${f.name.padEnd(15)} HUNG — ${e.message}. Find \`loop:\` springs / await-loops and gate them: loop: !useMotionOff()`);
    }
    forms.push(row);
    page.close().catch(() => {});
  }
} finally {
  await browser.close().catch(() => {});
}

// The served HTML, as a crawler without JavaScript reads it.
function hiddenCheck(html) {
  // Walk tags with a stack; track whether we're inside an element with the `hidden` attribute.
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const stack = [];
  let hiddenDepth = 0, h1 = null, hiddenChars = 0, visibleChars = 0;
  const re = /<!--[\s\S]*?-->|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>|<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { const n = m[4].replace(/\s+/g, " ").trim().length; if (hiddenDepth) hiddenChars += n; else visibleChars += n; continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[0].startsWith("</")) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i >= 0) { for (const e of stack.splice(i)) if (e.hidden) hiddenDepth--; }
      continue;
    }
    const isHidden = /(^|\s)hidden(\s|=|\/|$)/.test(m[3].replace(/aria-hidden=("[^"]*"|'[^']*'|\S+)/g, ""));
    if (tag === "h1" && !h1) h1 = { hidden: hiddenDepth > 0 || isHidden };
    if (VOID.has(tag) || m[3].trim().endsWith("/")) continue;
    stack.push({ tag, hidden: isHidden });
    if (isHidden) hiddenDepth++;
  }
  return { h1: h1 ? (h1.hidden ? "HIDDEN" : "visible") : "none", hiddenChars, visibleChars };
}
const crawl = [];
for (const [name, ua] of [["Googlebot", UA.googlebot], ["GPTBot", UA.gptbot]]) {
  try {
    const html = await (await fetch(o.url, { headers: { "user-agent": ua } })).text();
    const r = { crawler: name, ...hiddenCheck(html) };
    crawl.push(r);
    const bad = r.h1 !== "visible";
    if (r.h1 === "HIDDEN") pass = false;
    console.log(`  ${bad ? (r.h1 === "HIDDEN" ? "✖" : "!") : "✔"} ${name.padEnd(15)} served HTML: h1 ${r.h1} · text visible ${r.visibleChars} chars, inside hidden segments ${r.hiddenChars}${r.h1 === "HIDDEN" ? "  ← a streamed Suspense boundary (app/loading.tsx?) hides the page from crawlers that run no JS" : r.hiddenChars > 200 ? "  ← streamed segments still hidden: the robot form should stream nothing" : ""}`);
  } catch (e) { console.log(`  ! ${name}: fetch failed (${e.message})`); }
}

finish({ outDir, rel, pass, result: { tool: "check-motion", url: o.url, forms, crawl }, summary: pass ? "responsive with motion off and for robots; crawlers read the h1" : "a hung page or a hidden h1 — see above" });
