# The measurement harness

A scroll bench that drives **real Chrome** with **real wheel events** and reports
the cold scroll against the warm one. Nothing else surfaces the first-visit
penalty this starter is prone to.

## Setup

`playwright-core` drives the browser but ships no browser of its own — it uses
the Chrome already installed. Install it **in a scratch directory, not in the
project**, so the starter gains no dependency:

```sh
mkdir -p /tmp/perf && cd /tmp/perf && npm init -y && npm i playwright-core
```

Then run the script below from there, pointing at the built site
(`yarn build && yarn start` in the project first).

## `bench.mjs`

```js
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const URL = process.env.URL || "http://localhost:3000/";
const CPU = Number(process.env.CPU || 4);        // 1 = your machine, 4 = a phone-ish floor
const NET = process.env.NET || "none";           // none | wifi | fast3g
const RUNS = Number(process.env.RUNS || 3);
const WAIT = process.env.WAIT || "[data-preloader]";  // overlay to wait out, if any

const PROFILES = {
  none: null,
  wifi:   { downloadThroughput: 30e6 / 8, uploadThroughput: 10e6 / 8, latency: 20 },
  fast3g: { downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8, latency: 150 },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Recorded inside the page: every frame gap, every long task.
const RECORD = () => {
  window.__p = { frames: [], tasks: [], marks: [] };
  let last = performance.now();
  const tick = (t) => { window.__p.frames.push([t, t - last]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__p.tasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
};

const stats = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return { p50: +at(50).toFixed(1), p95: +at(95).toFixed(1), p99: +at(99).toFixed(1), max: +s.at(-1).toFixed(1) };
};

async function pass(page, name) {
  await page.evaluate((n) => window.__p.marks.push({ n: n + ":start", t: performance.now() }), name);
  const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const STEP = 60;
  for (let i = 0, n = Math.ceil(distance / STEP) + 40; i < n; i++) {
    await page.mouse.wheel(0, STEP);          // a real wheel event — Lenis needs one
    await sleep(12);
    if (i % 25 === 0 && i > 40) {
      const done = await page.evaluate(
        () => scrollY >= document.documentElement.scrollHeight - innerHeight - 4);
      if (done) break;
    }
  }
  await sleep(400);
  await page.evaluate((n) => window.__p.marks.push({ n: n + ":end", t: performance.now() }), name);
}

function summarise(p, name, media) {
  const a = p.marks.find((m) => m.n === name + ":start")?.t ?? 0;
  const b = p.marks.find((m) => m.n === name + ":end")?.t ?? Infinity;
  const frames = p.frames.filter(([t]) => t >= a && t <= b).map(([, d]) => d).slice(1);
  return {
    frames: stats(frames),
    janky: frames.filter((d) => d > 33).length,
    frozen: frames.filter((d) => d > 66).length,
    longtask_ms: +p.tasks.filter((t) => t.start >= a && t.start <= b)
      .reduce((x, y) => x + y.dur, 0).toFixed(0),
    assets: media.filter((m) => m.end >= a && m.end <= b).map((m) => m.url),
  };
}

const runs = [];
for (let i = 0; i < RUNS; i++) {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,   // headless GPU behaviour differs from what users see
    args: ["--force-device-scale-factor=2"],
  });
  // A fresh context per run, so "cold" really is cold: empty HTTP cache, empty
  // image-decode cache, no layers warmed by the run before.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(RECORD);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  if (PROFILES[NET]) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...PROFILES[NET] });
  }

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction((sel) => !sel || !document.querySelector(sel), WAIT, { timeout: 30000 });
  await page.waitForFunction(() => document.body.scrollHeight > innerHeight + 10);
  await sleep(600);

  await pass(page, "cold");
  await page.evaluate(() => window.lenis ? lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0));
  await sleep(1200);
  await pass(page, "warm");

  const p = await page.evaluate(() => window.__p);
  // Resource timing shares the clock with the frame marks, so "fetched during
  // the first scroll" is exact rather than inferred.
  const media = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((e) => e.initiatorType === "img" || /_next\/image\?|\.(avif|webp|png|jpe?g|woff2?)/i.test(e.name))
      .map((e) => ({ url: e.name, end: e.responseEnd })));

  runs.push({ cold: summarise(p, "cold", media), warm: summarise(p, "warm", media) });
  await browser.close();
}

const avg = (f) => +(runs.map(f).reduce((a, b) => a + b, 0) / runs.length).toFixed(1);
for (const k of ["cold", "warm"]) {
  console.log(`${k.toUpperCase()}  worst=${avg((r) => r[k].frames.max)}ms  p99=${avg((r) => r[k].frames.p99)}ms  ` +
    `>33ms=${avg((r) => r[k].janky)}  >66ms=${avg((r) => r[k].frozen)}  ` +
    `longtask=${avg((r) => r[k].longtask_ms)}ms  assets=${avg((r) => r[k].assets.length)}`);
}
console.log("\nfetched during the FIRST scroll:");
for (const u of runs[0].cold.assets) console.log("  " + u.replace(/^https?:\/\/[^/]+/, ""));
writeFileSync("bench.json", JSON.stringify(runs, null, 2));
```

Run it:

```sh
URL=http://localhost:3000/ CPU=4 RUNS=4 node bench.mjs
```

## Reading the result

```
COLD  worst=387ms  p99=217ms  >33ms=11  >66ms=10  longtask=83ms  assets=11
WARM  worst=26ms   p99=17ms   >33ms=1   >66ms=0   longtask=0ms   assets=0
```

That is the signature: **cold much worse than warm, with assets fetched during
the cold pass**. The page is not slow — it is doing first-visit work in animating
frames. Go to the skill's §2.

After the fix the two rows should read the same, and `assets` on the cold row
should be `0`.

## When you need to know *why*, not just *how much*

Only then, add a trace — and accept that tracing itself perturbs frame timing, so
never quote headline numbers from a traced run.

```js
const events = [];
cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));
const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
await cdp.send("Tracing.start", {
  transferMode: "ReportEvents",
  traceConfig: { includedCategories: [
    "devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "gpu",
  ] },
});
// … run the passes …
await cdp.send("Tracing.end"); await done;
```

Then total `e.dur` by `e.name` over each pass window and diff cold against warm.

**Do not add `cc`, `viz` or `disabled-by-default-cc.debug`.** They produce a
multi-hundred-megabyte trace whose own overhead swamps the jank you are hunting —
it will read as if the problem vanished.

What the names tell you:

| event | meaning |
|---|---|
| `ImageDecodeTask` | image decode. Present cold, absent warm = the §2 problem, confirmed |
| `GPUTask` (GPU process) | raster / texture upload / compositing |
| `Layerize`, `Commit`, `Paint` | compositing work; high every frame = §3 |
| `UpdateLayoutTree`, `Layout` | style and layout; spikes mean forced reflow |
| `FunctionCall`, `FireAnimationFrame` | your JS, per frame |

**The decisive check:** if frames are dropping but the longest main-thread
`RunTask` is ~20ms, the main thread is *not* the problem. Look at the GPU
process. A 200ms `GPUTask` with an idle main thread is raster or decode, and no
amount of JS optimisation will touch it.
