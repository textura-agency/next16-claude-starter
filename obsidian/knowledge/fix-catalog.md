---
tags: [knowledge, performance, catalog, stable]
updated: 2026-10-06
---

# Fix Catalog

Every fix here moved a **measured** number on a production site built from this
starter — 50+ animation-heavy marketing sites, measured with the
[[testing-pipeline]]. Read the section for your symptom **before** you start
fixing; it is the cheapest hour of any optimisation. How to read and extend it:
[[knowledge/README]].

**Status** — *rule*: measured on ≥ 3 sites, safe to apply first. *observed*:
1–2 sites, try it, measure it, don't assume it transfers. *inherited*: came with
the starter's skills, trusted but not re-measured. A *counter-case* is a site
where the fix did not help or hurt — read it.

**Numbers** are Lighthouse medians (≥ 3 runs) or the scroll test's verdict,
before → after, on the real host unless marked *local*. "Mobile 64 → 91" means
mobile Performance score.

Entry shape: **Symptom** (how you recognise it) · **Cause** · **Fix** ·
**Evidence** · **Status**.

> [!important] The starter now ships the fixes for its own old defects
> Several entries below were defects *the starter itself* seeded into every site
> (client-only cookie banner, an empty `loading.tsx`, a localhost canonical,
> looping springs that freeze under reduced motion…). They are fixed in the
> starter — see [[#Defaults the starter now ships — don't undo them]] at the end.
> An edit that reverts one reintroduces a measured defect.

---

## 1. LCP and load

### Serve the LCP copy at rest under an opaque curtain, then replay its entrance
- **Symptom:** the LCP element is hero copy whose spring/text engine
  server-renders its hidden start state (opacity 0, blur); LCP lands when the
  loader lifts — seconds in — and Lighthouse bills it with every task before it.
- **Cause:** LCP is the *first paint* of the largest element; a hidden start
  state postpones that paint to the reveal.
- **Fix:** while an opaque loader covers the first frame, render the copy **at
  rest** in the server HTML; at hydration (still covered) switch it to its start
  state — **only after a reported paint** (a `PerformanceObserver` for paint, or
  rAF → `setTimeout`), two bare rAFs lost the race 1 run in 3 — then play the
  same entrance with the same config and delay. Nothing visible changes.
- **Watch:** a large start blur makes the entering word's painted box bigger
  than the at-rest copy → the LCP moves to the entrance again. Keep the start
  blur ≤ ~16 px on the LCP line, or blur per line.
- **Evidence:** 3 sites — mobile 64 → 91 (LCP 10.7 → 2.3 s), 52 → 73, 59 → 85
  (LCP 13.7 → 3.1 s).
- **Status:** rule.

### Server-render the consent banner
- **Symptom:** the mobile LCP element is the cookie banner's paragraph; LCP is
  almost all *Render Delay*; `observedLargestContentfulPaint` far below the
  simulated LCP.
- **Cause:** a banner mounted with `dynamic({ ssr: false })` paints after
  hydration — at 412 px its paragraph is the largest text block. Lighthouse's
  simulation bills that paint with every CPU task and every request that finished
  before it (one site: a head-preloaded 1.5 MB model).
- **Fix:** render the banner in the server HTML, at rest; an inline script as the
  first child of `<body>` marks `<html data-consent>` when a choice is stored, and
  CSS hides the banner under that mark and on the robot form. `<html
  suppressHydrationWarning>`. **The starter now ships this** — keep it.
- **Design check:** if a site deliberately holds its banner behind an intro,
  showing it earlier is a consent-UX change — the client's call.
- **Evidence:** 13 sites. Measured alone: mobile 53 → 74 (LCP 11.0 → 2.3 s), PC
  85 → 94; 87 → 99. Combined: 73 → 99, 91 → 100, 64 → 95.
- **Status:** rule.

### Warm the optimised image candidate, never the source file
- **Symptom:** hosted LCP many times the local one; `total-byte-weight` in
  megabytes with `.png`/`.jpg` requests at their **raw** `/assets/…` path (not
  `/_next/image?…`); a preloader or reveal waiting on those decodes.
- **Cause:** code that fetches a `public/` file by path (`new Image().src =
  "/assets/x.png"`, CSS `url(/…)`, `<link rel=preload>`, a hand-cut `<picture>`)
  downloads the multi-MB master; `next/image` would have served AVIF/WebP at
  layout size.
- **Fix:** resolve through `getImageProps({ src, width, height, sizes })` and warm
  `props.srcSet` + `props.sizes` (set `sizes`, then `srcset`, then `src`), so the
  warm-up fetches exactly the candidate `<Image>` will pick. CSS backgrounds: the
  same props rewritten as `image-set(url(…) 1x, url(…) 2x)`. Art-directed
  `<picture>`: run each crop through `getImageProps`. Grep:
  `grep -rnE "new (window\.)?Image\(|url\(['\"]?/|rel=\"preload\"" src`.
- **Evidence:** 5 sites. Hosted mobile LCP **31.0 → 3.7 s**, perf 56 → 72, page
  11.5 → 0.57 MB (local mobile did not move — only the real host shows it);
  PC 52 → 64; a canvas reveal's detached image 2.8 MB → 20 KB.
- **Status:** rule.

### Defer media warming until after `load`
- **Symptom:** LCP Load Time high; below-the-fold images requested during load.
- **Fix:** "warm the page's media" runs in `requestIdleCallback` after
  `window.load`, never during.
- **Evidence:** starter-era, tablet LCP 4.9 → ~2.7 s.
- **Status:** inherited.

### `priority` on the LCP image — and lazy on its siblings
- **Symptom:** LCP Load Delay dominant; or the LCP is a hand-rolled `<img>` in an
  effect component fetched at default priority while its below-fold siblings
  compete; runs bimodal.
- **Fix:** `priority` on the LCP image only. A custom image component gets a
  `priority` prop → `fetchPriority="high"`, `loading="eager"`, `decoding="sync"`;
  every other instance `loading="lazy"`.
- **Evidence:** 1 site — robot mobile LCP 3.7 → 2.6 s, people mobile 93 → 98.
- **Status:** observed (+ inherited guidance).

### Preload the LCP image from the server when its component mounts client-only
- **Symptom:** the hero image has `priority`, yet Load Delay is seconds — its
  component is gated on a `mounted` state or `ssr: false`, so the preload never
  reaches the HTML.
- **Fix:** in the server view, `preload(props.src, { as: "image", imageSrcSet:
  props.srcSet, imageSizes: props.sizes, fetchPriority: "high" })` from
  `react-dom`, with `props` from `getImageProps` — one fetch serves both.
- **Evidence:** 1 site — mobile LCP 4.5 → 2.8 s (Load Delay 3.1 s → 0), 83 → 95.
- **Status:** observed.

### Put the LCP heading in the server HTML when a client-only scene would draw it
- **Fix:** the scene's loading placeholder renders the same heading at rest in
  the server HTML (under the curtain); the scene takes over on mount. A tiny LCP
  image can be inlined (a 2 KB AVIF) so it paints with the first frame.
- **Evidence:** 1 site — mobile ~79 → 96, LCP 4.45 → 2.4–3.0 s.
- **Status:** observed.

### `experimental.inlineCss` + scene downloads started at first paint, not in `<head>`
- **Symptom:** a server-rendered LCP billed with every download that finished
  before first paint — head preloads of a GLB/Draco decoder, render-blocking CSS.
- **Fix:** `experimental: { inlineCss: true }` in `next.config.ts`; start model /
  decoder fetches at first paint instead of `<link rel=preload>` in the head.
- **Evidence:** 3 sites — 87 → 90; LCP 2.1–3.6 → 2.4–2.6 s (steadier); LCP
  3–5 → 2.5–3.0 s.
- **Status:** rule (small but consistent).

### Below-fold media `preload="none"` until hydration
- **Symptom:** lab LCP flips run to run (2.3 ↔ 3.4 s) on an identical page; a
  large below-fold `<video preload="auto">` sometimes starts before first paint.
- **Fix:** serve it `preload="none"`, switch to `auto` when its section hydrates
  after `load`.
- **Evidence:** 1 site — 81/77 → 90/93 (interleaved A/B).
- **Counter-case:** on another site the same deferral did **not** move LCP — the
  render delay was JS, not bandwidth. Read the LCP phases first.
- **Status:** observed.

### A preloader counter that rewrites text every frame costs Speed Index
- **Fix:** draw the counter to a canvas (same face, size, colour, snapped to
  device pixels) — no text layout per frame.
- **Evidence:** 1 site — SI 5.2 → 4.4 s, mobile → 92/93.
- **Status:** observed.

---

## 2. Hydration and TBT

### Mount below-the-fold text engines near the viewport
- **Symptom:** one multi-second long task at hydration on a page of text-engine
  blocks; Lighthouse blames react-dom.
- **Cause:** every text engine measures its lines at mount (forced layouts), all
  in the hydration commit.
- **Fix:** render plain text (also what the server HTML holds) until the block is
  within ~1.5 viewports, then mount the engine; its entrance plays as before.
  Never on the first screen.
- **Evidence:** 3 sites — measured alone: mobile TBT 2,488 → 390 ms, 69 → 88, PC
  76 → 100; 81 → 93; 88 → 98.
- **Status:** rule.

### One clock per text effect, not a spring per character
- **Symptom:** a hydration / hand-over task re-rendering 100+ per-character
  spring controllers.
- **Fix:** one time-based spring per title; each character's state computed from
  it with the original delays/easings; **latch** it (no restart on re-entry — a
  restarting clock replays every title on the way back up); a character is a
  layer only while it moves.
- **Evidence:** 3 sites — hand-over task 403 → 103 ms, mobile 83–88 → 93;
  hydration ~240 → ~38 ms; TBT 360 → 63 ms.
- **Status:** rule.

### Per-letter headings: plain spans until they first play
- **Fix:** render letters as plain spans in their start pose; create the springs
  when the heading first plays.
- **Evidence:** 1 site — mobile 52 → 60, TBT 1,814 → 969 ms.
- **Status:** observed (same family as the two rules above).

### Hover springs only where a mouse can hover
- **Symptom:** dozens of hover spring controllers built at hydration on phones,
  where they never fire.
- **Fix:** a wrapper renders the element at rest until a fine pointer
  (`(hover: hover) and (pointer: fine)`) is seen after load, then swaps in the
  real hover. Engine untouched.
- **Evidence:** 3 sites — ~60 springs, TBT ~570 → ~400 ms; part of 625 → 508.
- **Status:** rule.

### Split the curtain-lift's entrances into their own tasks
- **Symptom:** one long task when the loader lifts — every hero entrance and text
  engine starts in the same tick.
- **Fix:** switch each entrance on in its own task ≈120 ms before its delay, so
  visible timing is unchanged. Expect axe to start catching first-screen copy
  mid-fade once the task is gone → see [[#A mask or clip sweep instead of an opacity fade on the first screen]].
- **Evidence:** 3 sites — mobile 88 → 93 (TBT 364 → 265 ms); reveal tasks ~146 →
  < 100 ms; a 54–73 ms lift frame gone.
- **Status:** rule.

### Hydrate below-the-fold blocks late — on approach, or one per idle moment
- **Symptom:** mobile TBT dominated by one hydration commit starting hundreds of
  reveal springs/engines, most far below the fold.
- **Fix:** wrap each below-hero section in a component that keeps the server HTML
  and delays hydration until near the viewport (`HydrateNear`), **or** hydrates
  one block per idle period after load. Put deferred blocks in memoised
  components — a re-rendering parent replaced not-yet-hydrated blocks with their
  empty fallback on one site.
- **Evidence:** on approach: 68 → 83 (TBT 512 → 72 ms), 47 → 54. Idle: 79 → 86,
  84 → 87. **Counter-case:** on approach made one site's mobile scroll janky
  (75–100 ms hydration frames) — prefer idle when blocks are heavy.
- **Order matters:** cut the work *per block* first. Splitting into blocks that
  each cost 275–395 ms left TBT higher (900–1000 ms).
- **Status:** rule for idle, observed for on-approach; always check the scroll
  test after.

### Move one-time geometry math off the main thread (Worker)
- **Symptom:** a multi-second task at load inside a `useMemo` building particle /
  geometry buffers (sampling, occlusion, fits).
- **Fix:** the same functions in a module worker, typed arrays transferred both
  ways; the scene holds its reveal until the result lands. Keep the
  `new Worker(new URL(…))` launcher in its own file (in the module the worker
  imports, it hung `next build`).
- **Evidence:** 5 sites — mobile TBT 4,269 → 207 ms (52 → 85, PC 70 → 97);
  44 → 58 (TBT 2,036 → 853); 70 → 80; 64 → 76.
- **Status:** rule.

### Render the whole scene in a worker (OffscreenCanvas) — phones, after load
- **Symptom:** one 300 ms+ task in the scene's effect (env map, shader compile,
  three.js evaluation).
- **Fix:** `canvas.transferControlToOffscreen()` → a module worker runs the
  unchanged scene; the page forwards pointer, visibility and size, posting state
  **only on change**. Keep a main-thread fallback. Check the scene uses no DOM
  APIs first.
- **Rules learned:** start it **after `load`** in its own task (during hydration
  TBT went 448 → 553 ms, after load → 409); **phones/tablets only** (on desktop
  its frames landed outside the page's: scroll 0 → 5 % dropped); the worker's
  clock must use the **same unit** as the page path (seconds for three.js — one
  site fed ms and ran every motion ~1000× fast); pace it so it doesn't out-draw
  the page on phones (measure the phone scroll whenever a scene moves to a
  worker).
- **Evidence:** 4 sites — mobile 91 → 98 (TBT 298 → 60 ms); 86 → 91.
- **Status:** rule (the strongest single TBT lever measured).

### three.js out of the first load
- **Symptom:** the scene chunk evaluates with the first scripts although the
  component is `next/dynamic`; or three.js lands in an unrelated chunk.
- **Fix:** `import()` the scene module from an effect after first paint. Never
  re-export a scene from a barrel `index.ts` (its siblings pull three.js in);
  never import from drei outside the lazy scene (one `useProgress` import put
  three.js in the first chunk).
- **Evidence:** 1 site — LCP 2.8 → 1.8 s. **Counter-case:** on a site whose
  preloader waited for the scene, a later chunk made people slower (PC 90 → 78) —
  measure.
- **Status:** observed.

### Keep `zod` (env validation) out of the client bundle
- **Symptom:** a client component imports `@/lib/site` → `env.ts` → zod: ~69 KB gz
  on first load.
- **Fix:** client code imports brand constants from a plain module; `site.ts` /
  `env.ts` stay server-only. Check after a build:
  `grep -l ZodError .next/static/chunks/*.js` must print nothing.
- **Evidence:** 1 site — 72 → 78; found in a second.
- **Status:** observed.

### Serve phones a phone layout from the server, not a JS width check
- **Symptom:** `useIsMobile` reads width 0 on the server → phones render and
  hydrate the desktop composition, then rebuild the mobile one; or a render that
  hides an element on phones differs from the server HTML (React #418, the whole
  root re-rendered).
- **Fix:** layout switches in CSS breakpoints. Where JS must decide, decide from a
  server hint (UA rewrite to a prerendered phone form) or render both and hide one
  with CSS; a width helper must treat width 0 as "unknown", never read `window`.
- **Evidence:** 1 site — ~0.25 s of the longest task removed (part of 66 → 98);
  another — a 453 ms task, local TBT 441 → 347 ms (hosted unchanged).
- **Status:** observed.

---

## 3. CLS

### Animate a preloader with transforms, not its box
- **Symptom:** CLS in the tenths on a page whose layout never moves; the shift
  sources are the preloader's bar and counter.
- **Fix:** a growing bar is `transform: scaleY()` / `scaleX()` from the edge it
  grows from; a moving counter keeps a fixed `top`/`bottom` and travels by
  `translate`. Where `scale` would distort a rounded corner,
  `clip-path: inset(0 0 0 X% round <radius>)`.
- **Evidence:** 3 sites — CLS PC 0.146 → 0, mobile 0.489 → 0; 0.038 → 0;
  0.076 → 0.001.
- **Status:** rule.

### Reserve the width of counting numbers
- **Fix:** an invisible copy of the final value holds the width; the counter fills
  that same box (`absolute inset-0 text-right`) so its own box never changes.
- **Evidence:** 2 sites — PC CLS 0.142 → 0 (94 → 100); mobile 0.104 → 0.
- **Status:** observed.

### Speeding up a geometry animation does not reduce CLS
CLS sums distance, not frames. Use transforms. (inherited; see [[pitfalls]])

---

## 4. Scroll jank

> Read freezes with the scroll test's cause column ([[testing-pipeline]]).
> **Cold bad, warm clean** = first-visit work in animating frames. **Both bad** =
> steady per-frame cost. Main thread idle + long frame = GPU / raster.

### Pre-promote reveals whose first frame janks
- **Symptom:** cold scroll janky, warm ideal; "render" or GPU frames of
  100–250 ms where a reveal (or a fixed `opacity: 0` layer with an expensive
  paint) first appears.
- **Diagnose:** render the reveals at rest — if the drops vanish, it's first-frame
  layer promotion (one site removed every backdrop blur: still janky; reveals at
  rest: clean).
- **Fix:** `will-change: opacity, transform` from load until the reveal ends,
  then release it. A panel fading in from 0: `will-change: opacity` keeps it
  painted while transparent.
- **Evidence:** 3 sites — cold max 242 → 83 ms; cold 3.3 → 0 % dropped (ideal
  3/3); 4.6 → 1.7 %.
- **Status:** rule. Not `will-change` everywhere — see [[pitfalls]].

### Blur once per line (or block), never per letter or word
- **Symptom:** scroll janky with the main thread idle while text reveals with a
  per-letter / per-word `filter: blur()`; LoAF of 200–900 ms with almost no
  script — a GPU wait.
- **Fix:** keep the per-letter stagger of opacity/transform; apply the blur as
  **one filter per line** (or per paragraph) that sharpens over the wave and is
  removed at rest. Waiting letters carry no blur / `will-change`. Never toggle the
  filter per letter mid-reveal (re-creates layers), and never a permanent
  `will-change` on per-letter spans (every character a layer: ~970 ms frames).
  Exclude the LCP line (a line-sized blurred box became one site's LCP at 7 s).
- **Evidence:** 6+ sites — desktop 5.1 → 0.9 % dropped; mobile freezes
  575–925 ms → none (cold 13.6–17.8 % → 0.3–1.4 %); per-word paragraphs 882 ms
  frames → none (21–28 % → 1–4 %); cold 14.6 → 2.7 %, worst 759 → 58 ms.
- **Status:** rule.

### Write per-frame styles only when they change, on the smallest element
- **Symptom:** dozens to hundreds of elements restyled every scroll frame; shows
  as "decode"/native work.
- **Cause:** a scroll/pointer loop rewriting transforms or CSS vars whether or not
  they changed — worst: a CSS variable on `<html>` (one site: 571 elements
  restyled per frame, plus every `background-attachment: fixed` panel reading it).
- **Fix:** cache the last written value and skip equal writes; write vars on the
  smallest element (or as its own transform); never write pointer-driven vars
  during touch scroll. Grep `documentElement.style.setProperty` in loops.
- **Evidence:** 3 sites — mobile 9 → ~1 % dropped; desktop 1.0 → 0 % (117–130
  restyles/frame gone).
- **Status:** rule.

### No blurred `text-shadow` / `drop-shadow` on content that moves every frame
- **Fix:** at most two shadow layers on static type; none on type or strips that
  move with scroll.
- **Evidence:** 1 site — mobile frames > 50 ms 15 → 2 (max 238 → 74 ms).
- **Status:** observed.

### Read scroll flags at the leaf; prewarm canvases that start hidden
- **Symptom:** a 150–240 ms React render where a scroll-driven flag flips.
- **Fix:** subscribe only the element that needs the flag; compile and draw one
  hidden frame per gated canvas at mount.
- **Evidence:** 1 site — 183 ms and 176 ms freezes gone.
- **Status:** observed.

### Image sequences on phones: portrait crops, off-thread decode, nearest-first
- **Symptom:** a scroll-scrubbed canvas sequence janks; `drawImage` decodes each
  frame synchronously (one site: 3.3 s of decode in one scroll).
- **Fix:** a centre-cropped portrait set for portrait phones (~⅓ the bytes);
  canvas sized to the frame; decode ahead with `createImageBitmap` /
  `img.decode()`; request frames nearest-first, a few per task (all 150 at once
  made a 150 ms frame).
- **Evidence:** 2 sites — janky (9 %) → ideal; cold 3.2–4.1 → 0.14–0.81 %.
- **Status:** observed.

### `<Image fill>` inside rounded, 3D-transformed tiles halves a phone's frame rate
- **Fix:** keep a CSS `background-image` on such tiles and feed it the optimiser
  URL (`getImageProps(…).props.src`) — the bytes win stays, the frame rate comes
  back.
- **Evidence:** 1 site — phone 2 % → 50 % dropped with `<Image fill>`, back to
  2 % with the background.
- **Status:** observed.

### Hydration or a lazy mount inside the first scroll
- **Symptom:** `script: React mounting a lazy chunk` mid-scroll; or the first
  wheel right after the loader lifts freezes (the scroll test starts ~1 s later
  and misses it).
- **Fix:** build and hydrate under the loader; mount below-fold scenes on idle
  after load (below); probe a wheel from the unlock frame.
- **Status:** observed (2).

### `<model-viewer>` swallows touch scrolling
- **Fix:** `touch-action="pan-y"` on the element (4.x defaults to `none`).
- **Evidence:** 1 site — a swipe over it scrolled 0 → 401 px.
- **Status:** observed.

---

## 5. 3D / WebGL

> The canonical procedure is the `optimize-3d-scene` skill ([[optimize-3d-scene]]).
> These are its measured entries.

### Prewarm everything the first frame draws — with its real target, in small steps
- **Symptom:** a long frame at the same scroll position every run, or the first
  real frame costs 40–1,000 ms, despite a `compileAsync` prewarm; the profile
  shows `getProgramInfoLog` / `linkProgram` / uploads on first draw.
- **Cause:** the program key includes tone mapping, render target / colour space,
  MSAA and light count — compiling for the canvas misses the composer's targets;
  three.js skips invisible objects; post passes (bloom, composite) never ran;
  `setTimeout(0)` chains run back to back in one frame.
- **Fix:** draw nothing until a prewarm has compiled every program **with the
  composer's render target bound**, objects **visible** during the compile, one
  program's uniforms / one texture or buffer upload per task, driven one step per
  `requestAnimationFrame` under the curtain; run every pass (bloom chain, final
  composite) once; a pass gated by strength 0 still runs once on frame one;
  `renderer.debug.checkShaderErrors = false` in production; check
  `renderer.info.programs` before and after.
- **Evidence:** 6 sites — first frame 1,032 → 48 ms; 250–390 → 84–110 ms (TBT
  450–540 → 310–336); 43–56 → 4–5 ms (scroll janky → ideal); a 755 ms mid-scroll
  task gone (mobile scroll janky → ideal).
- **Status:** rule.

### Build a proximity-mounted scene in idle steps
- **Fix:** create the renderer, then `await nextIdle()` before each heavy step
  (environment materials compiled under PMREM's state, PMREM's private programs
  warmed with an empty `fromScene`, the real `fromScene`, the model).
- **Evidence:** 1 site — mobile worst frame 159 → 52 ms, Lighthouse 71 → 75.
- **Counter-case:** building the scene in idle *after `load`* fixed the scroll but
  cost mobile perf 77 → 68 — anything after `load` lands in Lighthouse's window.
- **Status:** observed.

### Mount a below-the-fold scene on idle after load, not on proximity
- **Symptom:** a 100–200 ms `script` frame where a lazily mounted scene sits.
- **Fix:** also mount on `requestIdleCallback` ~2.5 s after load (keep proximity
  as fallback; pause the loop off screen). Watch mobile Lighthouse.
- **Evidence:** 1 site — mobile scroll janky (192 ms, 5/5) → ideal; perf 89 → 87–89.
- **Status:** observed. Don't defer *preloads* to "after the entrance" — they land
  on the first scroll (~700 ms stalls on one site).

### Cap a GPU-bound desktop scene at 60 fps
- **Symptom:** desktop scroll drops 2–10 % steadily, main thread idle, no frame >
  50 ms. The scroll test's display (and every 120 Hz Mac) redraws the scene every
  8.3 ms.
- **Fix:** draw at most every ~12.5 ms on **desktop** (an accumulator in the loop;
  12.5 sits between a 120 Hz and a 60 Hz tick so a 60 Hz frame never drops);
  keep motion time-based and per-tick easing stepping every tick — gate only the
  draw.
- **Evidence:** 5 sites — 2.3–2.6 → 0–0.15 %; 24/31 % → 0 %; 3.8 → 0.9–1.3 %.
- **Status:** rule (desktop only — for phones see [[#No fixed frame cap on phones]]).

### Clamp DPR per tier — renderer and composer
- **Fix:** desktop ≤ 1.5 (1.25 on heavy fill), phones 1–1.5; clamp the
  `EffectComposer` too. Refresh a `CubeCamera` reflection every Nth frame.
- **Evidence:** 3 sites — PC janky 4.8 % → ideal 0.2 %; a full-screen shader
  background p99 25.4 → 17.6 ms (pixel diff vs before 0.08 %).
- **Status:** rule.

### Cut per-frame passes, not the look
- **Fix:** `renderer.transmissionResolutionScale = 0.5` for glass; shadow map
  halved with `radius` halved (same softness); `shadowMap.autoUpdate = false` +
  update every other frame; fewer sphere segments; delete composers that render
  an empty layer (`grep layers.enable`) and feed the final pass a 1×1 black
  texture.
- **Evidence:** 2 sites — PC dropped 47 → 8.5 %, mobile janky → smooth (88 → 96);
  8 → 5 %.
- **Status:** observed.

### Raycast the shape, not the render mesh
- **Fix:** on `pointermove`, intersect the analytic shape
  (`ray.intersectSphere`) or a low-poly proxy, not a 74k-triangle mesh.
- **Evidence:** 1 site — mobile 1.0–2.6 % → ideal 0 %. **Counter-case:** a ground
  raycast replaced analytically on another site changed nothing — measure.
- **Status:** observed.

### Synchronous shader status reads block — poll `KHR_parallel_shader_compile`
- **Fix (raw WebGL):** compile + link, then each frame check
  `getProgramParameter(p, ext.COMPLETION_STATUS_KHR)`; read the status, use, draw
  only then. Keep the sync path when the extension is missing.
- **Evidence:** 1 site — mount self time 1,084 → 16 ms (4× CPU).
- **Status:** observed.

### Upload big buffers one per frame; build point clouds in typed arrays
- **Evidence:** seven ~17.7 MB buffers queued one per frame: an 84 ms mobile frame
  gone (smooth → ideal); positions written straight into a `Float32Array` instead
  of via `SphereGeometry`: 7× faster, 290 → 180 ms.
- **Status:** observed.

### Cull invisible additive particles in the vertex shader
- **Fix:** points with brightness 0 → `gl_Position = vec4(2.0, 2.0, 2.0, 1.0)`.
- **Evidence:** 1 site — GPU 7.8 → 4.6 ms per frame, image unchanged.
- **Status:** observed.

### Never let a canvas buffer follow a scroll-scrubbed box
- **Fix:** hold the buffer at the box's final size and stretch it over the live
  box with CSS; shaders in normalised coordinates draw the same picture.
- **Evidence:** 1 site — PC cold worst 159 → 51 ms.
- **Status:** observed.

### Models: WebP / Draco / strip / per-tier sizes
- **Fix:** `npx @gltf-transform/cli@4 webp in.glb out.glb --quality 85` for
  texture weight; `draco` for geometry weight (decoder copied from the same three
  version into `public/draco/`, disposed after load; rename the file for cache);
  strip attributes/textures the page never reads (prove identical geometry); ship
  textures at the size the GPU uses (`resize → webp → draco` per tier — `resize`
  drops Draco, so chain in that order).
- **Evidence:** 4 sites — 8.55 → 1.67 MB (PC 71 → 87, LCP 7.3 → 1.9 s); 3.56 →
  1.10 MB (mobile 52 → 83, LCP 17.4 → 1.25 s); 4.67 MB → 61 KB; per-tier models
  + post-paint start mobile 51 → 87.
- **Status:** rule (compress the model); observed per technique.

### Index glTF node names before `mixer.clipAction` on big rigs
- **Symptom:** a long task when a rigged model's animations start — the profile
  is inside three.js's `PropertyBinding` / `findNode`, once per track.
- **Cause:** binding a clip resolves every track's target by walking the model's
  subtree by name; a rig with hundreds of nodes and tracks walks it hundreds of
  times.
- **Fix:** traverse the model once into a `Map` of node name → object, and
  resolve tracks from it before `mixer.clipAction(…)` (or rename tracks to the
  objects' UUIDs from the index). Same idea for nearest-point lookups on a long
  curve: an exact spatial grid instead of a full scan (0 mismatches in 88 k
  checks).
- **Evidence:** 1 site — clip binding 297 → 12 ms at 4× CPU.
- **Status:** observed (1).

---

## 6. Fonts and media

### Subset local fonts to the Latin range — WOFF2, every feature kept
- **Symptom:** `next/font/local` faces as `.ttf`/`.otf`, preloaded at High
  priority, hundreds of KB competing with JS on 4G.
- **Fix:** `pyftsubset <font> --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+2215,U+FEFF,U+FFFD" --layout-features='*' --flavor=woff2`.
  **First** list every character the source renders outside that range (canvas
  text reads the document's face too). Keep a TTF where an OG `ImageResponse`
  reads it (satori can't read WOFF2) — grep the whole repo, not `src/`. One
  `src` per weight (a WOFF2 + WOFF pair preloads both). Instance away variable
  axes the design pins (`fonttools varLib.instancer`).
- **Evidence:** 10 sites — measured alone: 352 → 74 KB, mobile 83 → 89 (LCP 3.2 →
  2.3 s); WOFF2 without subsetting moved nothing. A CJK Google family fetching 240
  slices (2.8 MB) → 3 × 13 KB local subsets: LCP 15.8 → 2.2 s. Pinned axes:
  267 → 51 KB.
- **Status:** rule.

### Self-host third-party font stylesheets
- **Symptom:** a render-blocking `<link>` to a font CDN's CSS, then fonts from a
  second origin; FCP held ~2 s on a phone. Also: `next/font/google` makes every
  build depend on Google's network (a deploy failed on it).
- **Fix:** download the WOFF2 (check the licence), Latin-subset, `next/font/local`.
- **Evidence:** 1 site — mobile 68–71 → 79–83, FCP ~2 → 0.8 s.
- **Status:** observed.

### Encode video by role — and by codec
- **Symptom:** a 15–25 Mbps 4K master as the hero for every device; mobile perf in
  the 40s; or an HEVC clip that plays only where Chrome has a hardware decoder
  (blank elsewhere).
- **Fix:** desktop `ffmpeg -an -vf scale=1920:-2 -c:v libx264 -preset slow -crf 20
  -pix_fmt yuv420p -movflags +faststart` (check fine detail — CRF 23 lost faint
  stars once); phones 1280 px CRF 26; `<source media="(max-width: 767px)">`
  first. Always H.264, never HEVC. Check `ffprobe` bitrate first — re-encoding a
  2.7 Mbps source made it larger. Compare a crop + SSIM (≥ 0.99). A clip a shader
  samples at low resolution can be tiny (3.09 MB → 120 KB, pixel-identical
  through the shader).
- **Evidence:** 4 sites — 17.5 → 3.5 / 0.65 MB, mobile 47 → 93, scroll janky →
  ideal; 17.7 → 4.0 MB; 20.1 → 3.0 MB.
- **Status:** rule.

### Images: fix `sizes`, not `quality`
Decode cost tracks pixels, not bytes. A PNG overlay as AVIF at the same
resolution: 1.46 MB → 13 KB. A `%20` in a `next/image` `src` is encoded twice and
404s — rename the file. `object-cover` on Figma-cropped images keeps
`image-aspect-ratio` passing off the comp's breakpoint (2 sites, BP 93/96 → 100).
**Status:** rule (sizes), observed (rest).

### Phone stills of a scene: desktop quality, real density, deferred
- **Fix:** capture from the desktop-quality scene at phone shape and DPR 3
  (~1182 px wide), best frame, AVIF q70 + WebP q88 at 2×/3×, served unoptimised
  (the optimiser recompressed them), armed on first input or 3 s after load so
  Lighthouse doesn't fetch them. Look at 100 % next to the live scene.
- **Evidence:** 1 site — prod mobile 97 with the stills; with `loading="lazy"`
  alone Lighthouse fetched all three (87 → 89 after gating).
- **Status:** observed.

---

## 7. Accessibility (target: 100, people and robot form)

### A mask or clip sweep instead of an opacity fade on the first screen
- **Symptom:** people-run A11y flips 96 ↔ 100 — axe samples first-screen text mid-
  fade (1.1–4.4:1). Darker text can't fix it (a black title at 85 % opacity over
  a dark scene measured 4.21:1).
- **Fix:** reveal with a soft-edged `mask-image` / `clip-path` sweep or transform
  at **opacity 1** (same spring, same rise), removed at rest; or start at a
  contrast-passing opacity; or render first-screen copy at rest under the curtain.
  **First screen only** — masks on glass (backdrop-blur) repaint every frame
  (250–490 ms frames).
- **Evidence:** 4 sites — A11y 96 in 5/8 runs → 100 in 8/8; 96 in 8/8 → 100.
- **Status:** rule. Diagnose with `qa:axe` (samples the whole entrance).

### Repoint the text token, don't raise a shared alpha
- **Fix:** a new Tier-1 alpha (≥ 0.55 black on light, ≥ 0.46 white on black) and
  repoint only the text role — borders share the old value at 3:1. Real
  brand-colour failures get a text-role variant (e.g. a brand red 4.22:1 → a text
  red at 4.71:1), never a design-wide recolour.
- **Status:** inherited + rule (applied on most sites).

### Decorative text as CSS generated content
- **Symptom:** a deliberately faint watermark / marquee word fails
  `color-contrast` even under `aria-hidden`.
- **Fix:** `<span data-word="…" className="after:content-[attr(data-word)]" />` —
  outside the accessibility tree, same pixels. A list of brand names gets one
  `sr-only` copy. Switch to generated content after any cover lifts, not at first
  render (it doubled one site's simulated hydration task).
- **Evidence:** 3 sites — robot A11y 96/97 → 100.
- **Status:** rule.

### Let visible text name a control
- **Fix:** drop an `aria-label` that doesn't contain the visible text
  (`label-content-name-mismatch`); add missing purpose as an `sr-only` span at the
  end. A short visible label: `aria-label="GitHub (gh)"`.
- **Evidence:** 2 sites — robot A11y 96 → 100.
- **Status:** observed.

### `target-size`: fix spacing and overflowing rows, not negative margins
- **Fix:** look at the phone shot — a row that overflows pushes neighbours onto
  an icon; stack/wrap it. Real spacing (24 px centres; measure rendered tops —
  `text-box-trim` lies). `py-[5px] -my-[5px]` grows the box and makes targets
  overlap — it doesn't pass.
- **Evidence:** 2 sites — mobile A11y 96 → 100.
- **Status:** observed.

### A cookie banner on a fixed-panel site: under the header and the curtain, entering by clip
- **Symptom:** Accessibility 96 on some runs with the banner in the audit (an
  opacity entrance sampled mid-way); the banner sits over the phone menu or
  shows through a loading curtain.
- **Fix:** stack the banner **under** the header (so the phone menu covers it)
  and **under** the loading curtain (it is never seen half-revealed through
  it), and let it enter by a clip/mask sweep at **full opacity** instead of an
  opacity fade — every sampled moment has full-contrast text.
- **Evidence:** 1 site — Accessibility 96 → 100 in all runs.
- **Status:** observed (1).

---

## 8. SEO, robots, metadata, Best Practices

### Robots get the page at rest — proxy rewrite to a static robot form
- **Symptom:** PageSpeed / Lighthouse run by a person (bot UA) gets an LCP set by
  an intro, reveals that start hidden, a banner after hydration.
- **Fix:** `src/proxy.ts` rewrites bot UAs (search engines, lab tools **and AI
  crawlers**) to a prerendered static `/robot-view` of the same route — **same
  content, metadata, canonical**; the robot form skips the preloader, cursor and
  banner, sets `skipAnimation`, renders the first screen visible in the server
  HTML, scene → still. Humans unchanged. Never `await isBot()` in a page — it
  reads `headers()` and makes `/` dynamic for every visitor (`private, no-store`,
  CDN MISS). Detect the robot form by a server-rendered `<meta>`, not
  `pathname` (after a rewrite the URL is still `/`). Rest UI toggles (menus,
  modals) at their *closed* state, applying the engine's defaults first.
- **Evidence:** 8+ sites — robot mobile 72 → 83, 95 → 100, 86 → 100, 54 → 100,
  42 → 90; robot TBT 1,176 → 12 ms.
- **Status:** rule. **The starter ships the robot form** — extend it, don't
  bypass it.

### Delete an empty `app/loading.tsx`
- **Symptom:** `curl -A GPTBot <url>` shows the page inside `<div hidden id="S:0">`.
- **Cause:** a `loading.tsx` returning `null` still wraps the route in Suspense;
  the page streams into a hidden segment revealed by script. Non-JS crawlers read
  a hidden page.
- **Fix:** no `loading.tsx` unless it renders a real skeleton. Verify: curl as a
  bot — the `<h1>` must not sit under a `hidden` ancestor.
- **Evidence:** every site carried it; after deletion hidden text 1,619 → 0 chars.
- **Status:** rule (crawler fix, not a score lever — keep it even when Lighthouse
  doesn't move).

### Origin, canonical and share URLs
- **Symptom:** canonical, `og:url`, sitemap `<loc>` and robots `Sitemap` say
  `http://localhost:3000` in production (11 of 12 live sites checked) — and
  Lighthouse SEO still reads 100.
- **Fix:** `siteConfig.url` = `NEXT_PUBLIC_SITE_URL` → `https://` +
  `VERCEL_PROJECT_PRODUCTION_URL` → localhost, read through `env.ts`, known at
  build time (reading the request host makes every route dynamic). Coerce empty
  optional env vars to `undefined` — an empty `KEY=` from `.env.example` failed a
  `z.url().optional()` and broke the build once the config ran at import. A
  run-time `origin-sync` may rewrite head tags to `location.origin` **after
  hydration** (rewriting before it made React insert duplicate canonicals).
- **Check after any meta change:** fetch the live page, take `og:image`, curl it
  — must be 200, not localhost.
- **Status:** rule.

### Real brand metadata and a designed share card
- **Fix:** title = brand + what it is (≤ 60 chars, the page's real brand name);
  description 120–160 chars from the site's own copy; author/publisher = brand,
  no placeholder handle (omit Twitter handle tags unless real); `themeColor`;
  JSON-LD Organization with the real logo; OG image **1200 × 630** — a capture of
  the composed hero (no loader, banner or half-faded text) or a designed card
  (brand large, one line, the site's own fonts and scene art). Favicon from a
  square mark that reads at 16 px. `qa:brand` generates and checks the set.
- **Status:** rule (applied to 20+ sites on review).

### Linked routes must exist
- **Symptom:** `errors-in-console` — `404 /privacy-policy?_rsc=…`; `<Link>`
  prefetches every visible link, so a nav link to an unbuilt page is a console
  404 → Best Practices 96.
- **Fix:** build the route (route → view, own metadata, sitemap entry), or point
  the link at a section hash (`#contact`). Never `prefetch={false}` to hide it. A
  privacy page must still mount the consent banner, and a tall page under a
  centred body needs `justify-content: safe center`.
- **Evidence:** 4 sites — BP 96 → 100.
- **Status:** rule.

---

## 9. Phones and iOS

> None of these show in Lighthouse or the headless scroll test. They were found by
> a person on an iPhone after every instrument said "done". The procedure is
> [[mobile-device-qa]].

### Scenes sized to the large viewport; height-only resizes ignored on touch
- **Symptom (iPhone):** the scene flickers, goes blank or "jumps" on scroll and
  on every scroll-direction change; an r3f canvas can stay black.
- **Cause:** Safari's toolbar changes the viewport height while scrolling; boxes
  sized `100dvh` / `fixed inset-0` / `innerHeight` follow it, `setSize`
  reallocates (and clears) the buffer, scenes re-randomise; a static
  `frameloop` prop on `<Canvas>` is re-applied on re-render and stops the loop.
- **Fix:** canvas box at the **large** viewport height (`lvh`, or a px height
  read once), re-measured on touch only when the **width** changes; skip a resize
  whose size and DPR didn't change; on a real resize draw immediately; guard a
  worker scene's own resize handler too. Starter: `src/utils/stable-viewport.ts`,
  `src/components/common/scene-viewport.tsx`. Verify with `qa:ios`.
- **Evidence:** 5 sites — probe FAIL → PASS on all; phone scroll 9.8 → 1.5 %
  dropped; smooth → ideal.
- **Status:** rule.

### Never stop drawing a visible WebGL canvas on iOS
- **Symptom:** the hero "disappears" after a little scroll.
- **Cause:** a "freeze the scene after 10 % scroll" optimisation trusted WebKit
  to keep the last frame; iOS drops it after a toolbar re-composite.
- **Fix:** pause only when the canvas is fully off screen.
- **Evidence:** 1 site — probe FAIL → PASS.
- **Status:** observed.

### Recover a lost WebGL context
- **Symptom:** scroll the whole page and back → the hero scene is gone (iOS drops
  contexts under memory pressure, e.g. while decoding large stills).
- **Fix:** `webglcontextlost` → `preventDefault()`; when the scene nears the
  viewport / the tab returns / `pageshow`, check `gl.isContextLost()` and rebuild
  on a fresh context at rest (≥ 1 s between rebuilds, 3 retries); release the
  context on every teardown; don't reserve desktop-only targets on phones.
  Starter: `src/lib/scene/webgl-context.ts`. Verify with `qa:context`.
- **Evidence:** 1 site — probe FAIL → PASS, scroll ideal, Lighthouse unchanged.
- **Status:** observed (the gap exists on every long page with a live hero).

### No fixed frame cap on phones
- **Symptom:** "the scene feels low fps / looks bad" on an iPhone.
- **Cause:** a `t - last <= 1000/30` budget throttle on a 60 Hz loop draws every
  3rd frame (**20 fps**); on 120 Hz every 5th (**26 fps**). A capped scene can
  also trip its own fps-driven DPR fallback and drop every phone to DPR 0.75
  ("noisy").
- **Fix:** run at the display rate and pay for smoothness with a cheaper frame
  (DPR, samples, particles). If a cap is truly needed, skip alternate frames
  (`frame % 2`), never a budget throttle. Measure with `qa:fps`.
- **Evidence:** 7+ sites — 26 → 120 fps at rest with phone scroll *better*
  (1.19 → 0.58 %); 15 → 55–58 fps; 40 → 120 fps; scroll unchanged or better
  everywhere.
- **Status:** rule. (A desktop 60 fps *draw* cap for GPU-bound scenes is a
  different, measured rule — §5.)

### Per-frame motion scaled by delta time (120 Hz)
- **Symptom:** animations 2–4× too fast on a phone, or jittery.
- **Cause:** `+= k` per frame runs 2× at 120 Hz; two loops (StrictMode double
  mount, a worker + a page loop) double it again; a clock in the wrong unit
  (ms vs s) runs 1000×.
- **Fix:** every per-frame increment `+= k * dt * 60` or time-based; easing
  `1 - exp(-rate * dt)`; one time source in seconds. Starter:
  `src/lib/scene/per-frame.ts`. Check: simulate 120 Hz headless by replacing
  `requestAnimationFrame` with an 8 ms timer and compare speed against 60 Hz.
- **Evidence:** 1 site — phone motion 4.9 → 0.81 px/frame-at-60 vs 0.76–0.78 on
  the reference path.
- **Status:** observed (the check is cheap — run it on every scene).

### Full-screen menus: `top-0 h-dvh` + safe area, their own colour token
- **Symptom:** the menu's bottom button is hidden under Safari's bottom bar; or
  the menu's text has no contrast on a dark-mode phone.
- **Fix:** menus are static UI — `top-0 h-dvh` with bottom padding
  `max(pad, env(safe-area-inset-bottom) + pad)`, never `inset-0` / `h-lvh` (the
  opposite of canvases). Give the menu its own colour token — a `bg-background`
  that follows `prefers-color-scheme` turned one menu #0a0a0a under fixed-colour
  text. Portal the overlay under `<body>` (a transformed header doesn't let
  `fixed` cover the screen) but carry the CSS variables it reads. Create the
  portal inside the panel component, not from a `useTransition` callback (it
  remounted and lost focus). Lock scroll (stop Lenis), Escape closes, focus moves
  in and back, `aria-expanded`, `inert` when closed, reduced motion = a fade.
- **Evidence:** 4 sites (safe area), 1 (dark mode).
- **Status:** rule (safe area); observed (dark mode).

### Touch: sliders, swipes, overlays
- **Fix:** a horizontal slider whose drag handlers skip touch needs
  `touch-action: pan-x pan-y` / `manipulation`, not `pan-y`; check a sideways
  swipe moves it and a vertical one scrolls the page. No hover springs and no
  pointer-driven CSS writes on touch. A custom cursor never hides the native one
  and is off on coarse pointers.
- **Status:** observed.

### Touch scroll through fixed panels (Chrome)
- **Symptom:** on an Android phone a finger drag scrolls nothing (0 px) while a
  wheel and every desktop browser scroll fine; the phone scroll test reads
  0 % coverage or "never became scrollable".
- **Cause:** the page locks the document and scrolls a `position: fixed`
  inner scroller, with full-screen `position: fixed` panels (pinned scene
  layers, a fixed cookie banner) inside it. Chrome chains a touch scroll along
  the **containing block**, not the DOM: a fixed panel's containing block is the
  viewport, whose document is locked, so the drag never reaches the scroller.
  Wheel events bubble through the DOM, so wheel input still works.
- **Fix:** on coarse pointers turn off hit-testing on the panels (and the fixed
  banner) — `@media (pointer: coarse) { .panel { pointer-events: none } }` — and
  re-enable it on what must stay interactive inside them: controls, links,
  canvases. A drag that starts on a re-enabled button still won't scroll
  (Lenis `syncTouch` would, at the cost of native momentum — a design call).
- **Proof:** `node tools/qa/scroll-test.mjs --url … --touch-drag` — a real
  finger drag (CDP touch events) from each fixed full-screen panel must move
  the page.
- **Evidence:** 1 site — phone scroll coverage 0 % → 100 %.
- **Status:** observed (1).

### Gyroscope motion for static hero models (progressive enhancement)
- **Fix:** one module (`src/lib/scene/device-tilt.ts`): coarse pointers only,
  listeners after mount, iOS `requestPermission()` asked on a **tap** (iOS
  rejects it from a scroll's `touchend` — re-arm on the next tap), idle sway
  before/without permission, off for the robot form and reduced motion; the scene
  reads it per frame (±8–15° yaw, ±5–8° pitch, calm). No markup, no network —
  crawlers and Lighthouse see the same page.
- **Evidence:** applied on 7 sites; on 2 the client removed it after a phone
  review — it is a design choice, not a default.
- **Status:** observed.

### A loader must actually lock the scroll — Lenis ignores `overflow: hidden`
- **Fix:** stop Lenis while the loader shows (check no effect restarts it),
  `history.scrollRestoration = "manual"`, scroll to top when the loader leaves.
  A one-screen layout stops Lenis too.
- **Evidence:** 2 sites — a wheel flick under a loader landed the page 1,643 px
  down.
- **Status:** observed.

### A pinned scroll-story on phones (only with the client's approval)
- **Fix:** keep the hero live; below `md` the later sections scroll in normal flow
  over stills captured from the real scene (see §6 stills); the scene builds only
  what the hero shows. Phone-only classes, same CSS breakpoint for the JS switch.
- **Evidence:** 2 sites — 2.0–5.1 → 0.5/0 % dropped, worst 115 → 26 ms; 667 ms →
  smooth.
- **Status:** observed — removing scene content on phones is the client's call.

---

## Defaults the starter now ships — don't undo them

Each was a defect the starter seeded into every site, measured and fixed upstream.
Reverting one reintroduces it:

| Default | Why (measured) |
|---|---|
| Consent banner server-rendered, hidden by a `<html data-consent>` mark | the mobile LCP element on every site; 13 sites up to +26 points |
| Robot form via `proxy.ts` rewrite (AI crawlers included), `/` static | robot mobile up to 54 → 100; `await isBot()` made `/` dynamic |
| No empty `app/loading.tsx` | non-JS crawlers read the whole page inside `hidden` |
| Origin: `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → localhost | canonical said localhost on 11/12 live sites |
| `useMotionOff()` gates every `loop:` spring and `await`-spring loop | under `skipAnimation` (reduced motion, robot form) a loop never yields — the live page froze for those visitors on 6 sites |
| `/privacy-policy` exists; OG image 1200 × 630; no "New Project" metadata | BP 96 → 100; cropped share cards; placeholder titles |
| Scene helpers: stable viewport, per-frame dt + desktop draw gate, context recovery, tilt | the iOS defects in §9; desktop 120 Hz redraws |

## Related

[[knowledge/README]] · [[pitfalls]] · [[testing-pipeline]] · [[mobile-device-qa]] ·
[[optimize-load]] · [[optimize-performance]] · [[optimize-3d-scene]] · [[seo-aeo]]
