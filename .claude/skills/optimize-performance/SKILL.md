---
name: optimize-performance
description: Make a page in this starter actually smooth — build it, scroll it in real Chrome on PC and on an emulated phone, fix what the measurement blames, re-measure to prove it. Covers first-scroll jank and micro-freezes, dropped frames during scroll-driven animation, blur/filter and layer-promotion cost, per-frame style writes, lazy media decoding mid-reveal, hydration and lazy chunks landing mid-scroll, the first scroll after a loader, image sequences, INP and bundle cost. Use when the user says "it's slow", "janky", "micro freezes", "stutters on first scroll", "laggy scrolling", "optimise performance", "measure performance", or before shipping any animation-heavy page. For a three.js/WebGL scene use `optimize-3d-scene` first — that skill owns the GPU scene; this one owns the page around it. For load scores use `optimize-load`; for real-phone behaviour use `mobile-device-qa`.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Optimise page performance

This starter is built for animation-heavy marketing sites: springs on scroll,
text engines, Lenis smooth scroll, full-bleed imagery, often a WebGL scene. That
combination has characteristic failures, and they are **not** the ones people go
looking for. This skill was rewritten from scroll passes on ~50 production
sites built from this starter; each lever says whether it is a **rule** (held on
≥ 3 sites) or **observed** (1–2). Read `obsidian/knowledge/fix-catalog.md` and
`obsidian/knowledge/pitfalls.md` before fixing.

**The loop is the skill.** Build → measure → attribute → fix one thing →
re-measure. Never skip to the fix; never report a win you did not measure.

> **If the project renders a three.js / WebGL scene** (`three` in
> `package.json`, or a canvas with a render loop) — hard rule 14 sends you to
> **`optimize-3d-scene` first**. Come back here for the page around the scene.

## The bar

**`ideal` on PC and mobile, cold and warm:** no frame over 50 ms, ≤ 1 % dropped
frames, p99 ≤ 33 ms (budgets against 60 Hz even on a 120 Hz panel). `smooth` is
no frame > 100 ms and ≤ 3 % dropped; anything else is `janky`. A 50 ms frame is
three dropped frames at 60 Hz — where a hitch stops being subliminal.

## 0. Rules of measurement

1. **Measure the build, never `next dev`.** `yarn build && yarn start`. Kill the
   old server by port first; start the new one only if the build succeeded.
2. **Baseline before you touch anything.**
3. **3 runs, medians; a `1/3` freeze may be noise** — re-run before fixing. A
   result near the 1 % line is a draw: A/B the two builds back to back
   (interleaved, ≥ 2 rounds) and compare per-frame work, not one record.
4. **Throttle the CPU (4×) on the phone pass**, and emulate 4G — localhost
   hides lazy-load freezes; any `fetched` during a pass is a freeze waiting for
   a slower link.
5. **Change one thing at a time**, same config before and after.
6. **Tracing perturbs what it measures.** Use a trace or profile to *explain* a
   freeze, never to *measure* one.
7. **A busy machine fakes regressions.** Above a load average of ~15 a scroll
   verdict is unreliable (GPU contention reads as janky) — re-run, don't act.
   Probes use a plain Chrome UA (the default puppeteer UA gets the robot form).

## 1. The scroll test — run this before anything else

```sh
node tools/qa/scroll-test.mjs --url http://localhost:3000/     # PC wheel + mobile touch (4× CPU), cold then warm
node tools/qa/scroll-test.mjs --url … --devices mobile --runs 1 # chase one freeze
node tools/qa/scroll-test.mjs --url … --first-scroll            # + a scroll from the loader's unlock frame
```

It opens a **visible** Chrome (headless GPU behaviour differs), waits until the
page can actually scroll (Lenis running, no `overflow: hidden`), scrolls top →
bottom like a person — wheel bursts on PC, touch flings on mobile — jumps back,
and scrolls again warm. Every frame over 50 ms is reported with its **section**,
**cause** and **reproducibility**:

| cause | who owned the frame | look at |
|---|---|---|
| `decode (media fetched just before)` | an image/video decoded in the revealing frame | §2 lazy media |
| `gpu / raster (main thread idle)` | the GPU process: first paint of a big layer, a blur, a texture upload, a compile | §3 blur, layers, fill; `optimize-3d-scene` |
| `script` | JS — the LoAF names file, function, invoker (`FrameRequestCallback` = a rAF loop) | the named loop; per-frame writes §3 |
| `script: React render` | a render/commit mid-scroll (state set on scroll/in-view, a big subtree) | §2 hydration, §3 flags at the leaf |
| `script: React mounting a lazy chunk` | a `dynamic()` chunk loading inside the scroll | §2 |
| `render (style / layout / paint)` | style/layout — or, with 2–8 ms render inside a 200–900 ms frame, a GPU wait | §3 blur, per-frame styles |

Plus the worst sections by dropped frames — a page-wide 4 % was one section at
29 %. **Read it as a diagnosis:**

- **Cold bad, warm clean** → first-visit work inside animating frames — the most
  common shape in this starter. §2.
- **Both bad** → a steady per-frame cost. §3.
- **Desktop drops steadily with the main thread idle on a WebGL page** → the
  120 Hz panel: cap the scene's draw at 60 fps (`optimize-3d-scene` §5).
- **Both clean** → the complaint is about load (`optimize-load`) or about the
  real phone (`mobile-device-qa`).

Lighthouse never scrolls; you won't find this by hand either, because by the
time you scroll your own site you've warmed it. `references/measuring.md` has a
bench for tracing a freeze the tool already located;
`tools/qa/profile.mjs --url … --scroll-to "<selector>"` names the code.

**The test's first scroll starts ~1 s after the page unlocks — a person's starts
the instant the loader lets go.** Work landing in that second (a scene build,
section hydration) passed the test and was a reviewer's first impression on one
site. Probe that moment: `scroll-test.mjs --first-scroll` wheels from the
unlock frame — §2.

**What it can't tell you:** a phone's GPU (throttling slows the CPU, nothing
slows the Mac's GPU — use the counted checks in `optimize-3d-scene`), a real
network, iOS Safari. That's `mobile-device-qa`.

## 2. First-visit work — the usual culprit

### Lazy media decoding mid-reveal

`next/image` marks anything below the fold `loading="lazy"`; on a first visit
the fetch, decode and first paint land in the frame a reveal starts. **The
tell:** frames drop, the longest main-thread task is ~20 ms — the stall is in
raster/decode, not JS. **The fix:** decode the page's media up front — behind the
opening loader if there is one — warming the **`next/image` candidate**, not the
source file (`references/fixes.md` has the implementation and its four traps).
Warm in idle time well after first interaction or under the loader, never
"600 ms after the entrance" — that put a model decode on the first scroll
(~700 ms stalls, observed).

### Image sequences scrubbed by scroll (phones)

Each `drawImage` decodes synchronously on the main thread (3.3 s of decode in a
3,000 px scroll, observed). Ship a centre-cropped portrait set for portrait
phones (~⅓ the bytes), size the canvas to the frame, decode ahead with
`createImageBitmap` / `img.decode()` off the scroll path, request nearest-first
a few per task (all 150 at once made a ~150 ms frame). Observed (2): janky →
ideal hosted.

### Hydration, lazy chunks and scene builds inside the scroll

- **A `dynamic()` chunk that loads on scroll** lands its fetch, parse and mount
  in the revealing frame. Preload it after `load`, mount below-fold scenes on
  **idle after load** rather than on proximity, or stop making it dynamic.
- **Below-fold hydration** (`HydrateNear`, `RobotText lazy`) trades TBT for a
  hydration frame mid-scroll. One site's on-approach hydration made mobile
  scroll janky every run (75–100 ms frames); one block per idle moment after
  load kept it smooth — **rule** (`optimize-load` §4). Check the scroll test
  either way.
- **The first scroll after a loader.** Build the scene and hydrate the sections
  **under the loader**, not at its lift; split the curtain-lift's entrances into
  their own tasks (**rule**: a 54–73 ms lift frame gone). Stop Lenis while the
  loader is up — a preloader's `overflow: hidden` doesn't stop it: a wheel flick
  under one loader landed the page 1,643 px down. Details: `mobile-device-qa`
  §first scroll.
- **One bad frame at the loader's lift is not a scroll problem** — it's the
  entrance; fix it there, don't chase it here.

### Other first-visit costs

1. **Fonts** — `next/font` only, Latin WOFF2 subsets. A late webfont reflows
   every text engine at once.
2. **First paint of a large composited layer** — a full-bleed image, a
   `backdrop-filter`, a big `filter: blur()`. **Pre-promote reveal layers**:
   before blaming a blur or glass, render the reveals at rest — if the drops
   vanish, it's each block's first-frame layer promotion → `will-change:
   opacity, transform` from load until the reveal ends. **Rule** (3 sites — the
   glass was innocent each time).
3. **A panel fading in from opacity 0** isn't painted while transparent, so it
   all rasterises in its first visible frame (40–90 ms, main idle):
   `will-change: opacity` on the content keeps it painted (observed).
4. **Canvases gated by a scroll flag** compile on their first draw — prewarm one
   hidden frame at mount (observed).

## 3. Steady-state scroll cost

- **Blur once per line, never per letter or word.** Every letter animating its
  own `filter: blur()` is a separate filtered layer re-rasterised per frame —
  desktop scroll janky with the main thread idle. Keep the per-letter
  opacity/transform stagger; put one blur on the line (or paragraph) that
  sharpens over the wave and is **removed at rest**. **Rule** (5+ sites: 5–6 %
  → < 1 % dropped; 575–925 ms freezes → none; body copy too — per-word blur on
  card paragraphs was 880 ms frames). Don't *toggle* the filter per letter
  mid-reveal (re-creates layers); exclude the LCP title (a blurred line-box
  became one site's LCP at 7 s). Use the line-reveal pattern the project
  sanctions (an ADR) — the engine is protected.
- **No permanent `will-change` on per-character spans.** It makes every
  character a layer for the whole visit (~970 ms frames with a text-shadow
  halo, observed). Promote a character only while it moves; waiting =
  `opacity: 0`, settled = `transform/filter: none`.
- **One clock per text effect**, latched — never restart on re-entry, or every
  title replays on the way back (warm 0.1 → 9.9 % dropped, observed).
- **Write per-frame styles only when they change, on the smallest element.**
  Cache the last written value and skip equal writes; never write a CSS
  variable on `<html>` per frame (571 elements restyled per frame); never write
  pointer-driven variables during touch scroll. **Rule** (mobile 9 % → ~1 %;
  desktop 1.0 → 0 %, 117–130 restyles/frame gone).
- **Read scroll flags at the leaf.** A flag that flips mid-scroll, read by card
  components, rebuilt every per-letter binding (150–240 ms React render,
  observed): subscribe only the canvas/video that needs it.
- **Never let a canvas buffer follow a scroll-scrubbed box** — hold the buffer
  at the final size and stretch with CSS (`optimize-3d-scene` §6).
- **Everything per-frame goes through the shared ticker**
  (`src/lib/animation/ticker.ts`). A component with its own rAF is a bug —
  and a duplicate loop also doubles motion speed (§5 of `optimize-3d-scene`).
- **`getBoundingClientRect` per frame per component.** `<SpringTrigger>` /
  `<ProgressTrigger>` read layout every frame — hoist one measurement, gate on
  in-view, raise `frameInterval`.
- **Compositor-only properties.** `transform` and `opacity` are free; `filter`,
  `backdrop-filter`, `clip-path`, `width/height/top/left` are not. Masks on
  glass repaint every frame (250–490 ms, observed twice).
- **`background-attachment: fixed`** repaints on scroll — but profile the section
  before blaming the most suspicious CSS (`profile.mjs --scroll-to`); one site's
  fixed layers moved 53 → 50 dropped frames, the real cost was a per-frame CSS
  variable.
- **`<Image fill>` inside rounded, 3D-transformed tiles** halved one phone's
  frame rate (observed).
- **`<model-viewer>` swallows touch scrolling** — `touch-action="pan-y"` on it
  (observed).
- **Respect the engine's protection.** `src/components/animation/springs/` and
  `src/hooks/animation/` are `#do-not-modify` without sign-off (hard rule 2).
  Fix the *usage* first.

## 4. Load cost

Owned by `optimize-load` (Lighthouse, people + robot). The page-side basics:
hero image `priority`, everything else sized and lazy; `next/font/local`, no
font-CDN `<link>`; Server Components by default; `yarn build`'s First Load JS
per route — a marketing route above ~120 KB gz deserves an explanation;
`grep -l ZodError .next/static/chunks/*.js` prints nothing.

## 5. Prove it, then report it

Re-run the exact baseline command, same config, same runs. Report:

- the numbers before and after (verdict, dropped %, worst frame, per device and
  pass) and the config/load they were taken under;
- what you changed and why the measurement blamed it;
- **what you did not fix and why**, and what you reverted;
- anything you could not measure (a real phone's GPU, iOS).

Never report a fix you did not re-measure. "Should be faster" is not a result.
Never change the design to win frames — a visual-weight trade (fewer particles,
lighter blur) is the client's call: screenshot before/after and ask.

## 6. Then close the loop

- `yarn lint`, `npx tsc --noEmit -p .`, `yarn build`,
  `.claude/scripts/verify.sh` — zero FAILs (hard rule 11).
- `qa-verify` if any UI changed — a perf fix that breaks a reveal is not a win.
  Check the animations still *play*: warming a page by pre-scrolling it consumes
  every `mode="once"` reveal before anyone sees it.
- `node tools/qa/check-motion.mjs --url …` — reduced motion and the robot form
  still answer (a looping spring under `skipAnimation` hangs the page).
- **Retro.** Before closing, read your own notes once more: a fix with a
  measured before/after that the next project could reuse →
  `obsidian/knowledge/fix-catalog.md` (symptom, fix, evidence, rule/observed —
  a second site confirming an entry bumps its count; three makes it a rule); a
  hypothesis or tool reading that misled you → `obsidian/knowledge/pitfalls.md`;
  a skill that was wrong or silent → edit it now, and log it in
  `obsidian/meta/changelog.md`.
- Update the vault in the same turn: `obsidian/meta/changelog.md` with the
  measured numbers, an ADR in `obsidian/meta/decisions-log.md` if the fix
  changed how the project works.

## Related

[[optimize-performance]] · [[optimize-3d-scene]] · [[optimize-load]] · [[mobile-device-qa]] · [[qa-verification]] · [[testing-pipeline]] · [[ship]]
