---
name: optimize-performance
description: Make a page in this starter actually fast — build it, measure it in real Chrome, fix what the measurement blames, re-measure to prove it. Covers first-scroll jank and micro-freezes, dropped frames during scroll-driven animation, lazy media decoding mid-reveal, LCP/CLS/INP, bundle and hydration cost. Use when the user says "it's slow", "janky", "micro freezes", "stutters on first scroll", "laggy scrolling", "optimise performance", "measure performance", "improve Core Web Vitals / LCP", or before shipping any animation-heavy page. For a three.js/WebGL scene use `optimize-3d-scene` first — that skill owns the GPU scene; this one owns the page around it.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Optimise page performance

This starter is built for animation-heavy marketing sites: springs on scroll,
text engines, Lenis smooth scroll, full-bleed imagery. That combination has a
characteristic failure, and it is **not** the one people go looking for.

**The loop is the skill.** Build → measure → attribute → fix one thing →
re-measure. Never skip to the fix; never report a win you did not measure.

> **If the project renders a three.js / WebGL scene** (`three` in
> `package.json`, or a canvas with a render loop) — hard rule 14 sends you to
> **`optimize-3d-scene` first**. Come back here for the page around the scene.

## 0. Rules of measurement

These are not preferences; ignoring them produces confident wrong answers.

1. **Measure the build, never `next dev`.** Dev has no minification, no image
   optimisation, and a dev overlay that jitters the main thread.
   `yarn build && yarn start`.
2. **Measure before you touch anything.** A baseline you did not take is a win
   you cannot prove.
3. **Repeat every measurement 3–5 times and compare medians.** Single runs on a
   laptop swing wildly. A number from one run is an anecdote.
4. **Throttle the CPU (4×) so problems are visible.** Your machine hides on a
   fast laptop exactly what a visitor's phone will show.
5. **Change one thing at a time**, then re-measure with the *same* config. A
   before/after taken under different settings is not a comparison.
6. **Tracing perturbs what it measures.** Use a CDP trace to *explain* a
   regression, never to *measure* one — take the headline numbers untraced.

## 1. The first-scroll test — run this before anything else

Most "the site feels janky" reports in this starter are one specific thing, and
this test finds it in one shot.

Scroll the whole page **twice**: once on a cold load, then again after jumping
back to the top. Compare.

- **First scroll janky, second smooth** → the page is not slow. It is doing
  **first-visit work inside animating frames**: fetching, decoding, laying out
  and rasterising content the moment a reveal animation is trying to run. This
  is the common case, and §2 is the fix.
- **Both equally janky** → a steady-state per-frame cost. Go to §3.
- **Both smooth** → the complaint is about load, not scroll. Go to §4.

Lighthouse will not find this. It only ever measures a cold load and never
scrolls. Neither will you by hand, because by the time you scroll your own site
you have already warmed it.

`references/measuring.md` has the harness — a script that drives real wheel
events over the DevTools protocol, records `requestAnimationFrame` deltas and
long tasks, and reports cold vs warm side by side. Copy it into the project's
scratch space; it is not a committed dependency.

The numbers that matter, per pass:

| metric | what it means |
|---|---|
| **assets fetched during the scroll** | should be **0** on a warmed page; each one decodes in the frame that reveals it |
| **worst frame / p99 frame** | the freeze the user actually felt |
| **frames > 33ms / > 66ms** | how many times the page visibly hitched |
| **cold − warm delta** | the first-visit penalty, which is the whole diagnosis |

## 2. First-visit work — the usual culprit

### Lazy media decoding mid-reveal

Every section is server-rendered from the first frame, but `next/image` marks
anything below the fold `loading="lazy"`. The browser does not fetch it until it
nears the viewport — which, on a first visit, is the exact moment it is being
scrolled into view. Fetch, decode and first paint all land in that frame, next
to the reveal animation the same scroll just started.

**The tell:** frames drop, but the longest main-thread task in the trace is
~20ms. The stall is in the GPU/raster process, not JS. Chasing JS here wastes a
day.

**The fix:** decode the page's media up front, before the first scroll. If the
project has an opening loader, that is where it belongs — the work happens behind
a panel where there is nothing to stutter, and the loader's gauge can show real
progress instead of a timer. Full implementation, including the four traps that
make a naive version silently do nothing, in `references/fixes.md`.

### Other first-visit costs, in the order they usually bite

1. **Fonts** — `next/font` only. A late webfont reflows every text engine on the
   page at once.
2. **A `dynamic()` chunk that loads on scroll** — the fetch and parse land in the
   revealing frame. Preload it, or stop making it dynamic.
3. **First-paint of a large composited layer** — a full-bleed image, a
   `backdrop-filter`, a big `filter: blur()`. Its first rasterisation is
   expensive and happens exactly when it appears.

## 3. Steady-state scroll cost

If both passes are equally janky, the page costs too much *every* frame.

- **Everything per-frame goes through the shared ticker**
  (`src/lib/animation/ticker.ts`) — one rAF for the whole page. A component with
  its own `requestAnimationFrame` is a bug; find it.
- **`getBoundingClientRect` per frame per component.** `<SpringTrigger>` /
  `<ProgressTrigger>` each read layout every frame. A dozen of them on one page
  is a dozen forced layouts per frame. Raise `frameInterval`, gate on in-view,
  or hoist one measurement several components share.
- **Animate compositor-only properties.** `transform` and `opacity` are free;
  `filter`, `backdrop-filter`, `clip-path`, `width`/`height`/`top`/`left` are
  not. A spring driving `filter: blur()` on a large element will never hit 60fps.
- **Count your `<Inview>`s.** Each is an `IntersectionObserver`. Fine in dozens,
  not in hundreds.
- **Respect the engine's protection.** `src/components/animation/springs/` and
  `src/hooks/animation/` are `#do-not-modify` without sign-off (hard rule 2).
  Fix the *usage* first; changing the engine needs explicit approval.

## 4. Load cost

Measure with Lighthouse (mobile profile) on the built site or the deployed URL.
Targets: **LCP ≤ 2.5s · CLS ≤ 0.1 · INP ≤ 200ms**.

- Hero image gets `priority`; every other image is sized and lazy.
- Every image has explicit dimensions or a fixed aspect box — a late-sizing image
  is a CLS event.
- `next/font` with `display: "swap"`; no `<link>` to a font CDN.
- Server Components by default (hard rule 6). A `"use client"` near the root
  drags the whole tree into the bundle.
- Check what is actually shipped: `yarn build` prints per-route First Load JS.
  A marketing route above ~120KB gz deserves an explanation.

## 5. Prove it, then report it

Re-run the exact baseline command, same config, same number of runs. Put the
before and after side by side.

Report honestly:

- the numbers, before and after, and the config they were taken under;
- what you changed and why the measurement blamed it;
- **what you did not fix and why** — a known remaining cost stated plainly is
  worth more than a silent one;
- anything you could not measure.

Never report a fix you did not re-measure. "Should be faster" is not a result.

## 6. Then close the loop

- `yarn lint`, `yarn build`, `.claude/scripts/verify.sh` — zero FAILs (hard rule 11).
- The `qa-verify` skill if any UI changed — a perf fix that breaks a reveal is
  not a win. Check the animations still *play*: the classic mistake is warming a
  page by pre-scrolling it, which consumes every `mode="once"` reveal before
  anyone sees it.
- Update the vault in the same turn: `obsidian/meta/changelog.md` with the
  measured numbers, and an ADR in `obsidian/meta/decisions-log.md` if the fix
  changed how the project works.

## Related

[[optimize-performance]] · [[optimize-3d-scene]] · [[qa-verification]] · [[ship]]
