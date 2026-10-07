// The scroll test: real Chrome, real input, the whole page, cold then warm.
// Lighthouse never scrolls; this is what finds the micro-freezes a visitor
// feels. Changing DEVICES (lib/chrome.mjs) or TARGETS makes results across the
// change incomparable — re-take the "before".
// Built while measuring ~50 production Next.js sites; every guard below
// exists because the test once reported something false without it.
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { DEVICES, NET, launch } from "./chrome.mjs";
import { installScroller } from "./scroller.mjs";

export { DEVICES };

// Budgets are against 60 Hz even on a 120 Hz display: a 16.7 ms frame is smooth.
export const FRAME_BUDGET_MS = 1000 / 60;
export const TARGETS = {
  // "ideal" is the bar for optimized: nothing a person could feel, cold or warm.
  ideal: { freezeMs: 50, maxFreezes: 0, droppedPct: 1, p99Ms: 2 * FRAME_BUDGET_MS },
  smooth: { freezeMs: 100, maxFreezes: 0, droppedPct: 3 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (x, d = 1) => (x == null ? null : +x.toFixed(d));

// Injected before any page script. Records every frame gap with the scroll
// position it happened at, every long animation frame with its scripts, every
// layout shift. Flat arrays: the recorder must cost nothing. The position is
// the page's SCROLLER's (lib/scroller.mjs, installed first): a page that locks
// <html>/<body> and scrolls an inner element reads 0 on `scrollY` forever.
function RECORDER() {
  const P = (window.__scroll = { f: [], loaf: [], shifts: [] });
  let last = performance.now();
  const tick = (t) => { P.f.push(t, t - last, window.__sy()); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.duration < 50) continue;
        P.loaf.push({
          t: e.startTime, dur: e.duration, block: e.blockingDuration || 0,
          render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
          scripts: (e.scripts || []).sort((a, b) => b.duration - a.duration).slice(0, 3).map((s) => ({
            src: (s.sourceURL || "").replace(/^https?:\/\/[^/]+/, "").slice(-90),
            fn: (s.sourceFunctionName || "").slice(0, 60),
            invoker: (s.invoker || "").slice(0, 70), dur: Math.round(s.duration),
          })),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) P.shifts.push([e.startTime, e.value]); })
      .observe({ type: "layout-shift", buffered: true });
  } catch {}
}

// Ready = a person could scroll now. Cheap conditions first (tall document,
// Lenis running, no overflow lock), then PROOF: a small real scroll must move
// the page. Without the proof, a page whose hydration or loader is still
// pending on a slow link reads as ready and the whole pass scrolls nothing.
// Unlocked = tall document, Lenis running (or no overflow lock) — and it has
// STAYED that way for a full second. Intro animations commonly stop Lenis a
// beat after load; on a throttled phone that beat lands after a naive check.
async function waitUnlocked(page, timeout) {
  await page.evaluate(() => { window.__okSince = 0; });
  await page.waitForFunction(() => {
    // Any real scroll range counts: one phone page was 130 px taller than the
    // viewport (15 %) and a 1.2× rule waited on it forever. "Locked" is asked of
    // the scroller: an inner-scroller page keeps <html>/<body> hidden for good.
    window.__scroller(true);
    const ok = document.readyState === "complete" && window.__max() > 16 && !window.__locked();
    if (!ok) { window.__okSince = 0; return false; }
    window.__okSince ||= performance.now();
    return performance.now() - window.__okSince > 1000;
  }, { timeout, polling: 100 });
}

async function waitScrollable(page, device, cdp, timeout) {
  const t0 = Date.now();
  const { width: w, height: h } = device.viewport;
  await waitUnlocked(page, timeout);
  while (Date.now() - t0 < timeout) {
    const y0 = await page.evaluate(() => window.__sy());
    if (device.input === "wheel") { await page.mouse.move(w / 2, h / 2); await page.mouse.wheel({ deltaY: 120 }); }
    else await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(w / 2), y: Math.round(h * 0.45), yDistance: -120, speed: 800, gestureSourceType: "touch", preventFling: true });
    await sleep(450);
    if ((await page.evaluate(() => window.__sy())) > y0 + 2) {
      await page.evaluate(() => window.__top());
      await sleep(300);
      return Date.now() - t0;
    }
    await sleep(350);
  }
  return null;
}

const atBottom = (page) => page.evaluate(() => {
  const max = window.__max(), y = window.__sy();
  return { y, max, done: y >= max - 4 };
});

// Bursts of about one viewport, then a short pause — how people read a page.
async function scrollDown(page, device, cdp) {
  const { width: w, height: h } = device.viewport;
  await waitUnlocked(page, 30_000).catch(() => {});
  let lastY = (await atBottom(page)).y, stall = 0, moved = false;
  const deadline = Date.now() + 150_000;
  if (device.input === "wheel") await page.mouse.move(w / 2, h / 2);
  while (Date.now() < deadline) {
    if (device.input === "wheel") {
      for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: Math.round(h / 10) }); await sleep(16); }
      await sleep(320);
    } else {
      // Start above the bottom quarter: fixed bottom overlays (the cookie banner)
      // swallow a touch that lands on them, and the page never moves.
      await cdp.send("Input.synthesizeScrollGesture", {
        x: Math.round(w / 2), y: Math.round(h * 0.6), yDistance: -Math.round(h * 0.45),
        speed: 1600, gestureSourceType: "touch", preventFling: false,
      });
      await sleep(450);
    }
    const s = await atBottom(page);
    if (process.env.SCROLL_DEBUG) console.log(`      burst y=${Math.round(s.y)}/${Math.round(s.max)}`);
    if (s.done) break;
    if (s.y > lastY + 1) moved = true;
    stall = s.y <= lastY + 1 ? stall + 1 : 0;
    lastY = s.y;
    // Pinned or locked: stop and report the coverage. Before the first movement
    // allow longer — a late lock is waited out, not scored.
    if (stall >= (moved ? 6 : 20)) break;
  }
  await sleep(900);          // let the last reveal finish inside the window
  return atBottom(page);
}

const stats = (xs) => {
  if (!xs.length) return { p50: null, p95: null, p99: null, max: null };
  const s = [...xs].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return { p50: round(at(50)), p95: round(at(95)), p99: round(at(99)), max: round(s.at(-1)) };
};

function summarisePass(raw, a, b, sections, resources) {
  const frames = [];
  for (let i = 0; i < raw.f.length; i += 3) if (raw.f[i] > a && raw.f[i] <= b) frames.push([raw.f[i], raw.f[i + 1], raw.f[i + 2]]);
  frames.shift();   // the first gap straddles the pass start
  const gaps = frames.map((f) => f[1]);
  const total = gaps.reduce((x, y) => x + y, 0);
  const dropped = gaps.reduce((n, d) => n + Math.max(0, Math.round(d / FRAME_BUDGET_MS) - 1), 0);
  const sectionAt = (y) => {
    const c = y + sections.vh / 2;
    const hit = sections.list.filter((s) => c >= s.top && c < s.bottom).sort((p, q) => (p.bottom - p.top) - (q.bottom - q.top))[0];
    return hit ? hit.name : `y=${Math.round(y)}`;
  };
  const inWin = (t) => t > a && t <= b;
  const freezes = frames.filter((f) => f[1] > TARGETS.ideal.freezeMs).map(([t, ms, y]) => {
    const loaf = raw.loaf.filter((l) => l.t < t && l.t + l.dur > t - ms).map((l) => ({ dur: Math.round(l.dur), block: Math.round(l.block), render: Math.round(l.render), scripts: l.scripts }))[0] || null;
    const fetched = resources.filter((r) => r.end > t - ms - 200 && r.end <= t + 20).map((r) => r.url).slice(0, 5);
    // The first question of every freeze: whose time was it? A long animation
    // frame dominated by script is JS; one dominated by render is style/layout/
    // paint; no long frame at all means the main thread was free and the stall
    // was in the GPU process — raster, decode or upload (optimize-performance §2).
    // React's scheduler runs its work from a MessageChannel, so a long frame whose
    // script is invoked by "MessagePort.onmessage" is React rendering/committing —
    // and with a JS chunk landing just before, it is a lazy component mounting
    // mid-scroll (first seen at 151 ms, 3/3 runs).
    const react = loaf?.scripts?.[0]?.invoker?.includes("MessagePort.onmessage");
    const chunk = fetched.some((u) => /\.js(\?|$)/.test(u));
    const cause = !loaf ? (fetched.some((u) => /image|\.(avif|webp|png|jpe?g|gif|mp4|webm)/i.test(u)) ? "decode (media fetched just before)" : "gpu / raster (main thread idle)")
      : loaf.scripts.reduce((x, sc) => x + sc.dur, 0) >= loaf.dur / 2
        ? (react ? (chunk ? "script: React mounting a lazy chunk" : "script: React render") : "script")
        : "render (style / layout / paint)";
    return { t: Math.round(t - a), ms: Math.round(ms), y: Math.round(y), section: sectionAt(y), cause, loaf, fetched };
  });
  // Where the dropped frames are. A page can be janky with no single long
  // frame at all — a steady 25 ms p99 over one section (on one site, 4 % page-wide was one section at 29 %)
  // — and a total says nothing about which section to open.
  const per = {};
  for (const [, ms, y] of frames) {
    const k = sectionAt(y);
    const e = (per[k] ??= { section: k, ms: 0, dropped: 0 });
    e.ms += ms; e.dropped += Math.max(0, Math.round(ms / FRAME_BUDGET_MS) - 1);
  }
  const bySection = Object.values(per).map((e) => ({ section: e.section, seconds: round(e.ms / 1000), dropped: e.dropped }));
  return {
    bySection,
    frames: gaps.length, seconds: round(total / 1000),
    ...stats(gaps),
    droppedPct: total ? round((dropped / (total / FRAME_BUDGET_MS)) * 100, 2) : null,
    over50: gaps.filter((d) => d > 50).length,
    over100: gaps.filter((d) => d > 100).length,
    loafMs: Math.round(raw.loaf.filter((l) => inWin(l.t)).reduce((x, l) => x + l.dur, 0)),
    shift: round(raw.shifts.filter(([t]) => inWin(t)).reduce((x, [, v]) => x + v, 0), 4),
    fetched: resources.filter((r) => inWin(r.end)).map((r) => ({ url: r.url, type: r.type, kb: r.kb })),
    freezes: freezes.sort((p, q) => q.ms - p.ms).slice(0, 25),
  };
}

// How long a one-screen page is watched per pass — about what a scroll pass of
// a short page takes.
const STATIC_PASS_MS = 8000;

// The pointer across a one-screen page: sweeps on PC, short swipes on touch
// (they cannot scroll it, but touch handlers see them).
async function pointerPass(page, device, cdp, ms) {
  const { width: w, height: h } = device.viewport;
  const end = Date.now() + ms;
  let i = 0;
  while (Date.now() < end) {
    const x = Math.round(w * (0.15 + 0.7 * ((i * 0.37) % 1))), y = Math.round(h * (0.2 + 0.6 * ((i * 0.61) % 1)));
    if (device.input === "wheel") await page.mouse.move(x, y, { steps: 12 });
    else await cdp.send("Input.synthesizeScrollGesture", { x, y, xDistance: Math.round(w * 0.3), yDistance: 0, speed: 900, gestureSourceType: "touch", preventFling: true }).catch(() => {});
    await sleep(120);
    i++;
  }
}

async function oneRun({ url, name, headless, readyTimeout, video, headers = {}, warmup = false }) {
  const device = DEVICES[name];
  const { width: w, height: h } = device.viewport;
  const browser = await launch({ headless: headless ? true : false, window: { w: w + 40, h: h + 140 } });
  try {
    // A fresh context: empty HTTP cache, empty decode cache — "cold" is cold.
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(device.viewport);
    // Always a people UA: headless Chrome's own says "HeadlessChrome", which a
    // robot-form proxy sends to the robot view — no scene, no loader.
    await page.setUserAgent(device.ua);
    if (Object.keys(headers).length) await page.setExtraHTTPHeaders(headers);
    const cdp = await page.createCDPSession();
    if (!warmup) {
      if (device.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: device.cpu });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...NET[device.net] });
    }
    await installScroller(page);
    await page.evaluateOnNewDocument(RECORDER);

    // Crop to the emulated viewport: puppeteer sizes the recording from the
    // native window, so a phone run came out 1960×4241 with the page in one
    // corner.
    const recorder = video
      ? await page.screencast({ path: video, crop: { x: 0, y: 0, width: device.viewport.width, height: device.viewport.height } })
      : null;
    await page.goto(url, { waitUntil: "load", timeout: 90_000 });

    // A one-screen page (a single hero) has nothing to scroll. Its
    // experience is the pointer on the page, so each "pass" holds the page and
    // moves the pointer across it for as long as a scroll pass would take —
    // the same frames, the same thresholds, coverage 1 by definition.
    // "One screen" is asked of the scroller, never the document alone: a page
    // that locks <html>/<body> and scrolls a full-screen div has a one-screen
    // document and was once judged "static", 0 px scrolled, PASS.
    const oneScreen = await page.evaluate(async () => {
      const one = () => document.readyState === "complete" && (window.__scroller(true), window.__max() <= window.__vh() * 0.05);
      for (let i = 0; i < 2; i++) { await new Promise((r) => setTimeout(r, 2000)); if (!one()) return false; }
      return true;
    });
    if (oneScreen) {
      // A long page this file failed to find the scroller of must not pass as static.
      const unclaimed = await page.evaluate(() => window.__unclaimed());
      if (unclaimed) throw new Error(`the document is one screen, but ${unclaimed} scrolls — a long page read as static; teach lib/scroller.mjs to find this scroller`);
      if (warmup) { await pointerPass(page, device, cdp, 3000); return null; }
      const now = () => page.evaluate(() => performance.now());
      const hz = await page.evaluate(() => new Promise((res) => {
        const d = []; let last = performance.now();
        const f = (t) => { d.push(t - last); last = t; d.length < 45 ? requestAnimationFrame(f) : res(d.sort((a, b) => a - b)[22]); };
        requestAnimationFrame(f);
      }));
      const coldA = await now(); await pointerPass(page, device, cdp, STATIC_PASS_MS); const coldB = await now();
      await sleep(1500);
      const warmA = await now(); await pointerPass(page, device, cdp, STATIC_PASS_MS); const warmB = await now();
      await recorder?.stop();
      const raw = await page.evaluate(() => window.__scroll);
      const sections = await page.evaluate(() => ({ vh: innerHeight, list: [{ top: 0, bottom: innerHeight, name: "the one screen" }] }));
      const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => ({
        url: e.name.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), type: e.initiatorType,
        end: e.responseEnd, kb: Math.round((e.transferSize || e.encodedBodySize || 0) / 1024),
      })));
      return {
        static: true, readyMs: 0, refreshMs: round(hz, 2),
        coverage: { cold: 1, warm: 1, scrollPx: 0 },
        cold: summarisePass(raw, coldA, coldB, sections, resources),
        warm: summarisePass(raw, warmA, warmB, sections, resources),
      };
    }

    const readyMs = await waitScrollable(page, device, cdp, readyTimeout).catch(() => {
      throw new Error(`page never became scrollable within ${readyTimeout / 1000}s (loader? lenis stopped? overflow hidden on the scroller?)`);
    });
    if (readyMs == null) {
      const s = await page.evaluate(() => ({ max: Math.round(window.__max()), where: window.__describe() }));
      throw new Error(`the page is unlocked and ${s.max} px longer than the screen (scroller: ${s.where}), but ${device.input === "touch" ? "touch" : "the wheel"} never moved it within ${readyTimeout / 1000}s — a fixed layer over the page may swallow the input${device.input === "touch" ? " (scroll-test --touch-drag names it)" : ""}`);
    }
    await sleep(1000);

    if (warmup) { await scrollDown(page, device, cdp); return null; }

    const hz = await page.evaluate(() => new Promise((res) => {
      const d = []; let last = performance.now();
      const f = (t) => { d.push(t - last); last = t; d.length < 45 ? requestAnimationFrame(f) : res(d.sort((a, b) => a - b)[22]); };
      requestAnimationFrame(f);
    }));

    const now = () => page.evaluate(() => performance.now());
    const coldA = await now(); const cold = await scrollDown(page, device, cdp); const coldB = await now();
    await page.evaluate(() => window.__top());
    await sleep(1500);
    const warmA = await now(); const warm = await scrollDown(page, device, cdp); const warmB = await now();
    await recorder?.stop();
    // A long page that never moved measured the first screen only — an error, not a verdict.
    if (cold.max > 16 && cold.y <= 2 && warm.y <= 2) {
      const where = await page.evaluate(() => window.__describe());
      throw new Error(`the page is ${Math.round(cold.max)} px longer than the screen but scrolled 0 px in both passes (scroller: ${where}) — ${device.input === "touch" ? "a touch that lands on a fixed panel may be swallowed (try --touch-drag)" : "the wheel never reached the scroller"}`);
    }

    const raw = await page.evaluate(() => window.__scroll);
    const sections = await page.evaluate(() => ({
      vh: window.__vh(),
      list: [...document.querySelectorAll("header, main > *, section, article, footer, [data-section]")].map((el) => {
        const r = el.getBoundingClientRect(); const top = window.__yOf(el);
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
        const label = el.getAttribute("aria-label") || el.getAttribute("data-section") || el.querySelector("h1,h2")?.textContent?.trim().slice(0, 32) || "";
        return { top, bottom: top + r.height, name: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : cls ? "." + cls : ""}${label ? ` "${label}"` : ""}` };
      }).filter((s) => s.bottom - s.top > 40),
    }));
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => ({
      url: e.name.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), type: e.initiatorType,
      end: e.responseEnd, kb: Math.round((e.transferSize || e.encodedBodySize || 0) / 1024),
    })));

    return {
      readyMs, refreshMs: round(hz, 2),
      coverage: { cold: round(cold.max ? cold.y / cold.max : 1, 3), warm: round(warm.max ? warm.y / warm.max : 1, 3), scrollPx: Math.round(cold.max) },
      cold: summarisePass(raw, coldA, coldB, sections, resources),
      warm: summarisePass(raw, warmA, warmB, sections, resources),
    };
  } finally {
    await browser.close();
  }
}


// The visitor's first scroll happens the instant a loader lets go — the main
// pass starts ~1 s after unlock and missed exactly that moment on one site
// (a particle build + section hydration landing on the first wheel: 122–244 ms
// frames a person felt and the test never saw). This pass scrolls from the
// unlock frame itself, three bursts, and judges those frames alone.
async function firstScrollRun({ url, name, headless, readyTimeout, headers = {} }) {
  const device = DEVICES[name];
  const { width: w, height: h } = device.viewport;
  const browser = await launch({ headless: headless ? true : false, window: { w: w + 40, h: h + 140 } });
  try {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport(device.viewport);
    await page.setUserAgent(device.ua);
    if (Object.keys(headers).length) await page.setExtraHTTPHeaders(headers);
    const cdp = await page.createCDPSession();
    if (device.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: device.cpu });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...NET[device.net] });
    await installScroller(page);
    await page.evaluateOnNewDocument(RECORDER);
    await page.goto(url, { waitUntil: "load", timeout: 90_000 });
    // Unlocked, no hold: the first frame a person could scroll.
    await page.waitForFunction(() => { window.__scroller(true); return window.__max() > 16 && !window.__locked(); }, { timeout: readyTimeout, polling: "raf" });
    const a = await page.evaluate(() => performance.now());
    if (device.input === "wheel") await page.mouse.move(w / 2, h / 2);
    for (let b = 0; b < 3; b++) {
      if (device.input === "wheel") { for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: Math.round(h / 10) }); await sleep(16); } await sleep(320); }
      else { await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(w / 2), y: Math.round(h * 0.6), yDistance: -Math.round(h * 0.45), speed: 1600, gestureSourceType: "touch", preventFling: false }); await sleep(450); }
    }
    await sleep(600);
    const b = await page.evaluate(() => performance.now());
    const raw = await page.evaluate(() => window.__scroll);
    const sections = await page.evaluate(() => ({ vh: window.__vh(), list: [...document.querySelectorAll("header, main > *, section, footer")].map((el) => {
      const r = el.getBoundingClientRect(); const top = window.__yOf(el);
      const label = el.getAttribute("aria-label") || el.querySelector("h1,h2")?.textContent?.trim().slice(0, 32) || "";
      return { top, bottom: top + r.height, name: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${label ? ` "${label}"` : ""}` };
    }).filter((s) => s.bottom - s.top > 40) }));
    const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => ({ url: e.name.replace(/^https?:\/\/[^/]+/, "").slice(0, 120), type: e.initiatorType, end: e.responseEnd, kb: Math.round((e.transferSize || e.encodedBodySize || 0) / 1024) })));
    const pass = summarisePass(raw, a, b, sections, resources);
    const scrolledTo = await page.evaluate(() => Math.round(window.__sy()));
    if (scrolledTo <= 2) throw new Error("three bursts from the unlock frame scrolled 0 px");
    return { unlockAtMs: Math.round(a), scrolledTo, ...pass };
  } finally {
    await browser.close();
  }
}

const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const NUM = ["frames", "seconds", "p50", "p95", "p99", "max", "droppedPct", "over50", "over100", "loafMs", "shift"];

function verdictOf(pass) {
  const t = TARGETS;
  // A pass that did not reach the bottom measured part of the page: not a result.
  if (pass.coverage < 0.95) return "incomplete";
  if (pass.over50 <= t.ideal.maxFreezes && pass.droppedPct <= t.ideal.droppedPct && pass.p99 <= t.ideal.p99Ms) return "ideal";
  if (pass.over100 <= t.smooth.maxFreezes && pass.droppedPct <= t.smooth.droppedPct) return "smooth";
  return "janky";
}
const RANK = { ideal: 0, smooth: 1, janky: 2, incomplete: 3 };

// Median per metric across runs; freezes grouped by section, with how many
// runs reproduced each — a freeze seen once is noise, one seen every run is a bug.
function aggregate(runs) {
  const out = { runs: runs.length, static: runs.every((r) => r.static) || undefined, readyMs: median(runs.map((r) => r.readyMs)), refreshMs: median(runs.map((r) => r.refreshMs)),
    coverage: { cold: Math.min(...runs.map((r) => r.coverage.cold)), warm: Math.min(...runs.map((r) => r.coverage.warm)), scrollPx: runs[0].coverage.scrollPx } };
  for (const k of ["cold", "warm"]) {
    const m = Object.fromEntries(NUM.map((n) => [n, median(runs.map((r) => r[k][n]))]));
    m.fetchedCount = median(runs.map((r) => r[k].fetched.length));
    const groups = {};
    runs.forEach((r, i) => {
      for (const f of r[k].freezes) {
        const g = (groups[f.section] ??= { section: f.section, runs: new Set(), count: 0, worstMs: 0, sample: null, causes: {} });
        g.runs.add(i); g.count++; g.causes[f.cause] = (g.causes[f.cause] || 0) + 1;
        if (f.ms > g.worstMs) { g.worstMs = f.ms; g.sample = f; }
      }
    });
    m.freezeSections = Object.values(groups)
      .map((g) => ({ section: g.section, reproduced: `${g.runs.size}/${runs.length}`, count: g.count, worstMs: g.worstMs,
        cause: Object.entries(g.causes).sort((p, q) => q[1] - p[1])[0][0], sample: g.sample }))
      .sort((p, q) => q.worstMs - p.worstMs);
    // Dropped frames per section, summed over runs; share of that section's time.
    const sec = {};
    for (const r of runs) for (const e of r[k].bySection || []) {
      const g = (sec[e.section] ??= { section: e.section, seconds: 0, dropped: 0 });
      g.seconds += e.seconds; g.dropped += e.dropped;
    }
    m.dropsBySection = Object.values(sec).map((g) => ({ section: g.section, seconds: round(g.seconds), dropped: g.dropped,
      droppedPct: g.seconds ? round((g.dropped / ((g.seconds * 1000) / FRAME_BUDGET_MS)) * 100, 2) : 0 }))
      .filter((g) => g.dropped > 0).sort((p, q) => q.dropped - p.dropped).slice(0, 8);
    m.fetched = runs[0][k].fetched;   // the first run's list: the most honest "cold"
    m.coverage = Math.min(...runs.map((r) => r.coverage[k]));
    m.verdict = verdictOf(m);
    out[k] = m;
  }
  out.verdict = RANK[out.cold.verdict] >= RANK[out.warm.verdict] ? out.cold.verdict : out.warm.verdict;
  return out;
}

export async function scrollTest({ url, devices, runs, outDir, headless = false, readyTimeout = 30_000, video = false, firstScroll = false, headers = {}, log = console.log }) {
  mkdirSync(outDir, { recursive: true });
  const result = {};
  for (const name of devices) {
    if (!DEVICES[name]) throw new Error(`unknown scroll device "${name}"`);
    // One unrecorded pass first, so the server's image optimizer has encoded
    // every size this device asks for — as a CDN would have for any real
    // visitor. Without it, run 1 measures next/image's first-request encode.
    await oneRun({ url, name, headless: true, readyTimeout, headers, warmup: true }).catch((e) => log(`    ! warm-up ${name}: ${e.message}`));
    const samples = [];
    // One device failing must not throw away the other's record (one site lost
    // its PC scroll record to a phone-only failure).
    try {
    for (let i = 0; i < runs; i++) {
      const r = await oneRun({ url, name, headless, readyTimeout, headers });
      samples.push(r);
      const c = r.cold, w = r.warm;
      if (Math.min(r.coverage.cold, r.coverage.warm) < 0.95) log(`    ! scroll ${name} #${i + 1} reached only ${Math.round(r.coverage.cold * 100)}% / ${Math.round(r.coverage.warm * 100)}% of the page — pinned, locked, or not ready`);
      log(`    scroll ${name} #${i + 1}  cold: max ${c.max}ms  p99 ${c.p99}  >50ms ${c.over50}  drop ${c.droppedPct}%  fetched ${c.fetched.length}  │  warm: max ${w.max}ms  p99 ${w.p99}  >50ms ${w.over50}  drop ${w.droppedPct}%`);
    }
    } catch (e) {
      log(`    ✖ scroll ${name}: ${e.message}`);
      result[name] = { verdict: "error", error: e.message };
      continue;
    }
    result[name] = aggregate(samples);
    if (firstScroll) {
      const fsr = [];
      for (let i = 0; i < runs; i++) {
        try { fsr.push(await firstScrollRun({ url, name, headless, readyTimeout, headers })); }
        catch (e) { log(`    ! first-scroll ${name} #${i + 1}: ${e.message}`); }
      }
      if (fsr.length) {
        const worst = fsr.flatMap((r) => r.freezes).sort((p, q) => q.ms - p.ms).slice(0, 5);
        result[name].firstScroll = { runs: fsr.length, unlockAtMs: median(fsr.map((r) => r.unlockAtMs)), max: median(fsr.map((r) => r.max)), over50: median(fsr.map((r) => r.over50)), droppedPct: median(fsr.map((r) => r.droppedPct)), freezes: worst };
        log(`    first-scroll ${name}: unlock at ${result[name].firstScroll.unlockAtMs}ms · max ${result[name].firstScroll.max}ms · >50ms ${result[name].firstScroll.over50} (median of ${fsr.length})`);
      }
    }
    if (video) {
      // A separate, unmeasured run: the screencast itself costs frames.
      const file = join(outDir, `scroll-${name}.webm`);
      await oneRun({ url, name, headless, readyTimeout, headers, video: file }).catch((e) => log(`    ! video ${name}: ${e.message}`));
      result[name].video = `scroll-${name}.webm`;
    }
  }
  return { result, config: { devices: Object.fromEntries(devices.map((d) => [d, { ...DEVICES[d], ua: undefined, network: NET[DEVICES[d].net] }])), targets: TARGETS, budgetMs: round(FRAME_BUDGET_MS, 2), headless, serverWarmup: true } };
}

// The touch-drag check: a real finger drag (CDP Input.dispatchTouchEvent —
// touchStart, moves, touchEnd; not a synthesized gesture) that STARTS ON a
// fixed full-screen panel, and fails when the page does not move.
// Why: Chrome chains a touch scroll along the CONTAINING BLOCK, not the DOM. A
// `position: fixed` panel (a pinned scene layer, a fixed cookie banner…) inside
// a fixed inner scroller, with the document locked, chains to the locked
// viewport — the finger drag scrolls nothing — while a wheel over the same
// spot works (wheel events bubble to the scroller). Observed on a production
// site: phone scroll coverage 0 % → 100 % after turning off hit-testing on
// those panels on coarse pointers (pointer-events: none) and re-enabling it on
// the controls, links and canvases inside them.
// Each start point is dragged by touch, then by wheel at the same spot, from
// the top. Verdict per point: touch moved ⇒ ok; touch 0 px ⇒ FAIL (and the
// wheel result says whether it is this containing-block case).
export async function touchDrag({ url, headless = false, readyTimeout = 30_000, headers = {}, log = console.log }) {
  const device = DEVICES.mobile;
  const { width: w, height: h } = device.viewport;
  const browser = await launch({ headless: headless ? true : false, window: { w: w + 40, h: h + 140 } });
  try {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport(device.viewport);       // hasTouch → touch emulation on
    await page.setUserAgent(device.ua);
    if (Object.keys(headers).length) await page.setExtraHTTPHeaders(headers);
    const cdp = await page.createCDPSession();
    await installScroller(page);
    await page.goto(url, { waitUntil: "load", timeout: 90_000 });
    try { await waitUnlocked(page, readyTimeout); }
    catch {
      const s = await page.evaluate(() => ({ max: window.__max(), locked: window.__locked(), unclaimed: window.__unclaimed() }));
      if (s.unclaimed) throw new Error(`the page reads as one screen, but ${s.unclaimed} scrolls — a long page this check cannot follow; nothing was dragged`);
      if (s.max <= 16) return { static: true, points: [], scroller: "document", pass: true };
      throw new Error(`the page never unlocked within ${readyTimeout / 1000}s (loader? lenis stopped? overflow hidden on the scroller?)`);
    }
    await sleep(800);
    const info = await page.evaluate(() => {
      const s = window.__scroller(true);
      const name = (el) => { const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : ""; return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : cls ? "." + cls : ""}`; };
      const vw = innerWidth, vh = innerHeight;
      // Fixed, shown, covering ≥ 60 % of the screen, and not the scroller or one of its ancestors.
      const panels = [...document.querySelectorAll("body *")].filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.01) return false;
        if (el === s || el.contains(s)) return false;
        const r = el.getBoundingClientRect();
        const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        return area >= vw * vh * 0.6;
      }).slice(0, 3).map((el) => {
        const r = el.getBoundingClientRect();
        return { name: name(el), x: Math.round(Math.max(r.left, 0) + Math.min(r.width, vw) * 0.5), y: Math.round(Math.max(r.top, 0) + Math.min(r.height, vh) * 0.62) };
      });
      return { scroller: window.__describe(), max: Math.round(window.__max()), panels };
    });
    if (info.max <= 16) {
      const unclaimed = await page.evaluate(() => window.__unclaimed());
      if (unclaimed) throw new Error(`the page reads as one screen, but ${unclaimed} scrolls — a long page this check cannot follow; nothing was dragged`);
      return { static: true, points: [], scroller: info.scroller, pass: true };
    }
    const points = info.panels.length ? info.panels.map((p) => ({ ...p, on: `fixed panel ${p.name}` }))
      : [{ name: null, x: Math.round(w / 2), y: Math.round(h * 0.62), on: "the centre (no fixed full-screen panel on this page)" }];
    const out = [];
    for (const p of points) {
      // What a finger at that spot hits, and the fixed element it sits in.
      const hit = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { hit: null, fixedIn: null };
        let f = el; while (f && f !== document.body && getComputedStyle(f).position !== "fixed") f = f.parentElement;
        const nm = (n) => { const cls = typeof n.className === "string" ? n.className.trim().split(/\s+/)[0] : ""; return `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : cls ? "." + cls : ""}`; };
        return { hit: nm(el), fixedIn: f && f !== document.body && f !== window.__scroller() ? nm(f) : null };
      }, [p.x, p.y]);
      const drag = async (kind) => {
        await page.evaluate(() => window.__top());
        await sleep(500);
        const y0 = await page.evaluate(() => window.__sy());
        if (kind === "touch") {
          const dist = Math.round(h * 0.4), steps = 12;
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
          for (let i = 1; i <= steps; i++) {
            await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p.x, y: Math.round(p.y - (dist * i) / steps) }] });
            await sleep(20);
          }
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await page.mouse.move(p.x, p.y);
          for (let i = 0; i < 4; i++) { await page.mouse.wheel({ deltaY: 100 }); await sleep(30); }
        }
        await sleep(800);
        return Math.round((await page.evaluate(() => window.__sy())) - y0);
      };
      const touch = await drag("touch");
      const wheel = await drag("wheel");
      const ok = touch > 2;
      out.push({ ...p, ...hit, touchPx: touch, wheelPx: wheel, ok });
      log(`    ${ok ? "✔" : "✖"} drag from ${p.on} @${p.x},${p.y} (finger hits ${hit.hit || "nothing"}${hit.fixedIn ? `, inside fixed ${hit.fixedIn}` : ""}): touch ${touch} px · wheel ${wheel} px${!ok && wheel > 2 ? "  ← wheel moves, the finger doesn't: a fixed layer swallows the touch scroll" : ""}`);
    }
    return { static: false, scroller: info.scroller, max: info.max, points: out, pass: out.every((x) => x.ok) };
  } finally {
    await browser.close();
  }
}
