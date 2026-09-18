# The runner

Two scripts. The first audits all four categories across the three form factors
and reports medians. The second names the elements that shift, which Lighthouse
will not tell you.

## Setup

Both install into a **scratch directory, not the project** — the starter gains no
dependency:

```sh
mkdir -p /tmp/lh && cd /tmp/lh && npm init -y && npm i lighthouse
```

`chrome-launcher` comes with Lighthouse and finds the installed Chrome. Build and
serve the project first: `yarn build && yarn start`.

## `lh.mjs` — the audit

```js
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { writeFileSync, mkdirSync } from "node:fs";

const URL = process.env.URL || "http://localhost:3000/";
const RUNS = Number(process.env.RUNS || 3);      // never 1 — see the skill, §0.2
const TAG = process.env.TAG || "run";
const ONLY = process.env.ONLY || "";             // e.g. ONLY=mobile while iterating
const OUT = `reports/${TAG}`;
mkdirSync(OUT, { recursive: true });

const MOBILE_UA = "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Lighthouse's own mobile numbers (slow 4G + 4× CPU), reused for tablet.
const MOBILE_THROTTLING = {
  rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5,
  downloadThroughputKbps: 1638.4, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4,
};
const DESKTOP_THROTTLING = {
  rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1,
  requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0,
};

const DEVICES = {
  laptop: {
    formFactor: "desktop",
    screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    emulatedUserAgent: DESKTOP_UA, throttling: DESKTOP_THROTTLING,
  },
  tablet: {
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 768, height: 1024, deviceScaleFactor: 2, disabled: false },
    emulatedUserAgent: MOBILE_UA, throttling: MOBILE_THROTTLING,
  },
  mobile: {
    formFactor: "mobile",
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    emulatedUserAgent: MOBILE_UA, throttling: MOBILE_THROTTLING,
  },
};

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

for (const [name, device] of Object.entries(DEVICES)) {
  if (ONLY && ONLY !== name) continue;
  const samples = [];

  for (let i = 0; i < RUNS; i++) {
    const { lhr, report } = await lighthouse(
      URL,
      { port: chrome.port, output: "html", logLevel: "error" },
      { extends: "lighthouse:default", settings: { ...device, onlyCategories: CATEGORIES } },
    );
    writeFileSync(`${OUT}/${name}-${i}.html`, report);   // open this to read details
    writeFileSync(`${OUT}/${name}-${i}.json`, JSON.stringify(lhr, null, 2));

    const scores = Object.fromEntries(
      CATEGORIES.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)]));
    const metrics = {
      FCP: Math.round(lhr.audits["first-contentful-paint"].numericValue),
      LCP: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
      TBT: Math.round(lhr.audits["total-blocking-time"].numericValue),
      CLS: +(lhr.audits["cumulative-layout-shift"].numericValue ?? 0).toFixed(3),
      SI: Math.round(lhr.audits["speed-index"].numericValue),
    };
    // Everything that is not a pass, with the weight that decides if it matters.
    const failing = [];
    for (const cat of CATEGORIES) {
      for (const ref of lhr.categories[cat].auditRefs) {
        const a = lhr.audits[ref.id];
        if (!a || a.score === null || a.score >= 0.9) continue;
        if (a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "manual") continue;
        failing.push({ cat, id: ref.id, weight: ref.weight, score: a.score, detail: a.displayValue || "" });
      }
    }
    samples.push({ scores, metrics, failing });
  }

  const scores = Object.fromEntries(CATEGORIES.map((c) => [c, median(samples.map((s) => s.scores[c]))]));
  const metrics = Object.fromEntries(
    Object.keys(samples[0].metrics).map((k) => [k, median(samples.map((s) => s.metrics[k]))]));

  console.log(`\n══ ${name.toUpperCase()} ══ (median of ${RUNS})`);
  console.log("  " + CATEGORIES.map((c) => `${c}=${scores[c]}`).join("  "));
  console.log("  " + Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join("  "));
  // Spread across runs — if this is wide, do not trust any single number.
  console.log("  perf/run: " + samples.map((s) => s.scores.performance).join(", ") +
              "  LCP/run: " + samples.map((s) => s.metrics.LCP).join(", ") +
              "  CLS/run: " + samples.map((s) => s.metrics.CLS).join(", "));
  for (const f of [...samples.at(-1).failing].sort((a, b) => b.weight - a.weight).slice(0, 10)) {
    console.log(`    [${f.cat}] w${String(f.weight).padStart(2)} ${String(Math.round(f.score * 100)).padStart(3)}  ${f.id}  ${f.detail}`);
  }
}
await chrome.kill();
```

```sh
URL=http://localhost:3000/ RUNS=3 TAG=baseline node lh.mjs
```

Always take a `TAG=baseline` before changing anything, and diff against it.

### Digging into one report

```js
const r = JSON.parse(require("fs").readFileSync("reports/baseline/mobile-0.json", "utf8"));
r.audits["largest-contentful-paint-element"].details.items[1].items   // the LCP phases
r.audits["mainthread-work-breakdown"].details.items                   // where TBT goes
r.audits["bootup-time"].details.items                                 // per-chunk JS cost
r.audits["network-requests"].details.items.filter((i) => i.statusCode !== 200)   // 404s
r.audits["color-contrast"].details.items                              // each failing node
r.audits["uses-responsive-images"].details.items                      // oversized images
```

## `cls.mjs` — what actually moved

Lighthouse's `layout-shifts` audit frequently returns scores with **no node
attached**, which makes CLS unfixable from the report alone. The
`PerformanceObserver` gives you `sources` with the real element and its
before/after rects. Needs `playwright-core` (`npm i playwright-core` in the same
scratch dir) or any CDP driver.

```js
import { chromium } from "playwright-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.env.W || 1440), H = +(process.env.H || 900), CPU = +(process.env.CPU || 4);

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  window.__cls = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls.push({
        t: Math.round(e.startTime),
        value: +e.value.toFixed(4),
        sources: (e.sources || []).map((s) => ({
          tag: s.node?.tagName,
          cls: (s.node?.className || "").toString().slice(0, 70),
          txt: (s.node?.textContent || "").trim().slice(0, 40),
          from: `${Math.round(s.previousRect.y)},${Math.round(s.previousRect.height)}`,
          to: `${Math.round(s.currentRect.y)},${Math.round(s.currentRect.height)}`,
        })),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
if (CPU > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
await page.goto(process.env.URL || "http://localhost:3000/", { waitUntil: "load" });
await sleep(9000);   // long enough to outlast every entrance animation on the page
const shifts = await page.evaluate(() => window.__cls);
console.log(`CLS ${shifts.reduce((a, b) => a + b.value, 0).toFixed(4)} over ${shifts.length} shifts`);
for (const s of [...shifts].sort((a, b) => b.value - a.value).slice(0, 10)) {
  console.log(`+${s.t}ms  ${s.value.toFixed(4)}`);
  for (const src of s.sources.slice(0, 3))
    console.log(`     <${src.tag} class="${src.cls}"> ${src.from} -> ${src.to} "${src.txt}"`);
}
await browser.close();
```

Two things this is for:

1. **Naming the element.** The `from -> to` rects tell you *how* it moved. A
   changing **height** with a constant `y` is something growing — an image being
   sized, a box being animated. A changing `y` is something above it growing.
2. **Checking whether a CLS of 0 is real.** This probe watches for the full 9s;
   a Lighthouse trace may end earlier. If Lighthouse says 0 and this says 0.18,
   the shift is real and was simply missed.

## Contrast arithmetic

Do not eyeball this — compute it. Blend the alpha over the surface in sRGB, then
apply the WCAG formula:

```js
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const blend = (fg, alpha, bg) => fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));

// minimum alpha that clears 4.5:1
const need = (bg, fg) => { for (let a = 0.2; a <= 1.001; a += 0.005) if (ratio(blend(fg, a, bg), bg) >= 4.5) return a; return 1; };
```

Text needs **4.5:1** (3:1 at ≥24px or ≥19px bold). Borders, icons and other
non-text UI need **3:1** — which is why a raw alpha shared between a text token
and a border token cannot simply be raised; add a new one and repoint only the
text role.
