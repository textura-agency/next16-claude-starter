# Recipes — probes and code shapes for mobile-device-qa

Scratch probes go in a scratch folder, never in `tools/` or `src/`. Resolve
puppeteer / Playwright from the `tools/qa` cache (`yarn qa:setup`; see
`tools/qa/README.md` for how the tools import them) — the project gains no
dependency. Every probe sets a person's UA.

```js
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
await page.setUserAgent(IPHONE_UA);
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: IPHONE_UA });
```

## Horizontal overflow (§5)

```js
for (const w of [320, 360, 390, 430]) {
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 1500));
  const { sw, iw, culprit } = await page.evaluate(() => {
    const iw = innerWidth;
    const culprit = [...document.querySelectorAll("body *")]
      .find((el) => el.getBoundingClientRect().right > iw + 1);
    return { sw: document.documentElement.scrollWidth, iw,
      culprit: culprit && `${culprit.tagName}.${[...culprit.classList].join(".")}` };
  });
  console.log(w, sw === iw ? "OK" : `OVERFLOW ${sw} > ${iw} (${culprit})`);
}
```

## Dark mode (§4)

```js
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
```
Screenshot every overlay (menu, modal, banner) in both schemes and look.

## 120 Hz, and speed (§3)

```js
// before navigation — a 120 Hz rAF. Compare against a run without it.
await page.evaluateOnNewDocument(() => {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 8);
});
```
Take two screenshots 1/60 s of *page time* apart at rest in each mode and
compare pixel change (or log the scene's own time value per second on both
paths, page and worker). Equal motion per 1/60 s = dt-correct.

Duplicate loops: count rAF callbacks per frame —

```js
await page.evaluateOnNewDocument(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafPerFrame = [];
  let n = 0;
  raf(function tick() { window.__rafPerFrame.push(n); n = 0; raf(tick); });
  window.requestAnimationFrame = (cb) => { n++; return raf(cb); };
});
```
A scene that should own one loop showing 2 per frame is the 2× bug.

## Touch swipe — sliders vs page scroll (§5)

```js
const cdp = await page.createCDPSession();
async function swipe(x0, y0, x1, y1, steps = 12) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// sideways on the slider: its translate/scrollLeft must change, scrollY must not
// vertical on the slider: scrollY must change
```

## Gyroscope (§6)

```js
await page.evaluate(() => {
  for (const [beta, gamma] of [[45, 0], [45, 20]]) {        // first sample = baseline
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta, gamma }));
  }
});
await new Promise((r) => setTimeout(r, 800));               // let the ease settle
await page.screenshot({ path: "tilt-right.png" });
```
Repeat with `gamma: -20`; the model turns calmly. With
`prefers-reduced-motion: reduce` and with a bot UA, the two shots are identical.
No `requestPermission` prompt fires on load.

## Lenis under the loader, scroll restoration, the first wheel (§7)

```js
// during the loader: wheel / swipe, then read scrollY each frame until unlock
await page.mouse.move(700, 450);
for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: 400 }); await new Promise((r) => setTimeout(r, 50)); }
const y = await page.evaluate(() => scrollY);  // must be 0 when the loader leaves
```

```js
// the first wheel from the unlock frame, with Long Animation Frames recorded
await page.evaluateOnNewDocument(() => {
  window.__loaf = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) =>
    window.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration),
      s: e.scripts?.map((x) => x.sourceFunctionName || x.invoker).slice(0, 3) })))
    .observe({ type: "long-animation-frame", buffered: true });
});
// poll until the loader is gone (its selector, or lenis.isStopped === false), then wheel at once
```
No script-attributed frame > 50 ms in the first seconds after unlock.

```html
<!-- the head script, before anything scrolls -->
<script>history.scrollRestoration = "manual"</script>
```

## Menu shape (§4)

```tsx
// Created INSIDE the panel component — never returned straight from a
// react-spring useTransition render callback (that remounts the portal).
function MenuPanel({ open, onClose }: MenuPanelProps) {
  const first = useRef<HTMLAnchorElement>(null);
  useScrollLock(open);                          // stops Lenis + html overflow
  useEffect(() => { if (open) first.current?.focus(); }, [open]);
  return createPortal(
    <div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      className="fixed left-0 top-0 z-[90] w-full h-dvh bg-menu-ground text-menu-ink
                 pb-[max(var(--space-6),calc(env(safe-area-inset-bottom)+var(--space-6)))]"
    >
      {/* links: display face, large; CTA + contact at the foot */}
    </div>,
    document.body,
  );
}
```
Own tokens (`--menu-ground`, `--menu-ink`) that don't flip with the theme
unless the page does. Escape closes; a link closes, then scrolls; focus returns
to the toggle.

## Stills for phones (§8)

```tsx
<picture>
  <source type="image/avif" srcSet="/stills/wave-788.avif 788w, /stills/wave-1182.avif 1182w" sizes="100vw" />
  <source type="image/webp" srcSet="/stills/wave-788.webp 788w, /stills/wave-1182.webp 1182w" sizes="100vw" />
  <img src="/stills/wave-1182.webp" alt="" width={1182} height={2559} decoding="async" />
</picture>
```
Captured from the desktop-quality scene at 3× (`tools/qa/capture-still.mjs`),
encoded AVIF q≈70 / WebP q≈88, never re-encoded by `next/image`; `src`/`srcset`
attached on first input or ~3 s after `load`.

## WebKit, when the tool isn't enough

```js
// Playwright from the tools/qa cache
const { webkit, devices } = playwright;
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });  // UA, DPR 3, touch
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load" });
// touch momentum: page.touchscreen.tap / a sequence of mouse.wheel is not touch —
// drive scroll with page.evaluate(() => scrollBy({ top, behavior: "smooth" })) in steps,
// and reproduce the reviewer's exact sequence (down to the bottom, wait, back up).
```
WebKit-on-macOS is not iOS Safari (no real toolbar, a different GPU), but it
runs WebKit's compositor and canvas rules — closer than Chrome.
