---
name: optimize-load
description: Get a page into Lighthouse's green zone on desktop and mobile, for people AND for the robot form crawlers get — build it, audit all four categories (Performance, Accessibility, Best Practices, SEO), fix what the audit blames, re-measure to prove it. Covers LCP (loaders, curtains, the consent banner, fonts, media), CLS, TBT/hydration, bundle cost, contrast and mid-fade accessibility, 404s from linked-but-missing routes, metadata, the brand kit and crawlability. Use when the user says "check Lighthouse", "get it in the green", "improve the score", "Core Web Vitals", "PageSpeed", "test on mobile and desktop", "SEO and accessibility audit", "make it load fast", or before handing a site to a client. For scroll jank and micro-freezes *after* load, use `optimize-performance` instead.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Get the page into the green

Lighthouse, two form factors (plus tablet when it matters), four categories,
two audiences (people and the robot form), then fix and prove it. Rewritten from
optimisation passes on ~50 production sites built from this starter; each lever
says whether it is a **rule** (held on ≥ 3 sites) or **observed** (1–2).
Before fixing, read `obsidian/knowledge/fix-catalog.md` and
`obsidian/knowledge/pitfalls.md`.

**The bar** (reached on every one of those sites): **Performance ≥ 90 on mobile
and desktop; Accessibility, Best Practices and SEO = 100 on both**, for people
and for the robot form. 100 on the last three is reachable without changing the
design — the classic "axe caught a fade mid-way" flake is fixable (§3). Don't
chase Performance from 96 to 100; do chase an A11y 96.

> **Scope.** This skill owns the **load**: navigation to settled. Scroll jank
> after load is **`optimize-performance`** — Lighthouse never scrolls. A WebGL
> scene: run **`optimize-3d-scene`** first. Real-phone behaviour Lighthouse can't
> see (iOS toolbar, 120 Hz, menus): **`mobile-device-qa`**.

## The loop

Build → audit (people + robot, mobile + desktop) → attribute → fix one thing →
re-audit. Never report a score you did not re-measure.

## 0. Rules of measurement

Ignoring these produces confident wrong answers. Each one cost real time.

1. **Audit the build, never `next dev`.** `yarn build && yarn start`. Kill the
   old server by port first (`next start` runs as `next-server`), and start the
   new one only if the build succeeded — a failed build serves the previous
   `.next`, and the A/B compares the old build with itself.
2. **Median of ≥ 3 runs; 5 before calling a regression.** On one unchanged build
   LCP swung 2.7 → 4.6 s and CLS 0 → 0.18. Lantern can simulate the same
   preloader-gated LCP at 0.85 s or 4.6 s run to run (one live site scored 89 /
   90 / 68 / 90 / 68 in one sitting) — compare
   `metrics → observedLargestContentfulPaint` too.
3. **People and robot are different pages.** The starter's proxy serves bots —
   and Lighthouse's default UA, and PageSpeed Insights — the robot form
   (`references/robot-path.md`). A people run needs a plain Chrome UA. Audit
   both; the robot form is what Google and PSI score.
4. **Localhost is a floor, not the record.** One site's mobile LCP was 4.8 s
   locally and **31 s on its real host** (11 MB of raw PNGs Lantern only charged
   on a real network). The other way round too: on asset-heavy pages localhost
   over HTTP/1.1 bills ~4–6 extra LCP points. Judge local A/Bs by deltas and TBT;
   take the record on the deployed URL (`--url https://…`).
5. **A shared or busy machine moves TBT 2×.** Interleave A/B arms (old, new,
   old, new) so both see the same load; note `sysctl -n vm.loadavg`. Build the
   baseline from a `git worktree` of the base branch, never by copying `.next/`.
6. **Change one thing at a time, and test the hypothesis first.** The opening
   loader was the obvious suspect for a 4 s LCP; removing it entirely moved TBT
   20 ms and made two profiles *worse*.

## 1. Run it

```sh
yarn qa:setup                                    # once — deps go to a cache outside the project
node tools/qa/lighthouse.mjs --url http://localhost:3000/ --runs 3   # people, mobile + desktop
node tools/qa/lighthouse.mjs --url http://localhost:3000/ --as-bot   # the robot form (Google, PageSpeed)
node tools/qa/lighthouse.mjs --url <candidate> --ab <reference>     # interleaved A/B on a busy machine
node tools/qa/axe-sweep.mjs  --url http://localhost:3000/            # contrast/target-size through the whole entrance
```

(`tools/qa/README.md` lists every flag — `--devices`, `--runs`, `--as-bot`,
`--ab`, `--min-perf`/`--min-other` gates.)
`references/runner.md` has the raw Lighthouse Node API recipe and the CLS
`PerformanceObserver` probe for digging; the tool is the record.

Report the grid — four categories × mobile/desktop × people/robot:

| | mobile people | mobile robot | desktop people | desktop robot |
|---|---|---|---|---|
| Performance | | | | |
| Accessibility | | | | |
| Best Practices | | | | |
| SEO | | | | |

## 2. Attribute before fixing

**Performance weights**: TBT 30, LCP 25, CLS 25, FCP 10, SI 10. The
"Opportunities" list is weight 0.

**Read the LCP phase breakdown** — it names the fix:

| dominant phase | what it means |
|---|---|
| **TTFB** | server or hosting |
| **Load Delay** | the image is discovered late — preload it, or it is behind JS |
| **Load Time** | the file is too big, or competing for bandwidth |
| **Render Delay** | downloaded but not painted — the main thread is busy, or something covers it (a loader, a curtain, a hidden start state). **Not a network problem.** |

**Which element is it, and when did it paint?** Check the LCP element's
*timing*, not just its identity — a blurred word mid-entrance can out-measure
the whole resting headline (§4, blur halo).

**CLS: Lighthouse does not tell you what moved.** Use the `PerformanceObserver`
probe in `references/runner.md`. When the deployed CLS is higher than local,
re-run locally against the production build with a longer trace — a plain run
can end before a late shift (observed).

**TBT — name the code before touching it:** `node tools/qa/profile.mjs --url …`
profiles a cold load at 4× CPU with source maps and prints the busiest runs by
**original** file. Lighthouse's `long-tasks` times are *simulated* — a 711 ms
task "at 3.4 s" was ~180 ms of hydration at 0.5 s observed — so lining a task up
with the page's own timeline (a preloader finishing, a reveal) picks the wrong
suspect. Two fixes aimed by timing moved nothing or doubled TBT
(`<Suspense>` splits 393 → 834 ms) until the profile named react-spring set-up
in hydration.

**A resource asked for by raw path bypasses `next/image`.** If
`network-requests` shows `.png`/`.jpg` at `/assets/…` rather than
`/_next/image?…`, find who requested it — a preloader's `new Image()`, a CSS
`url()`, a `<link rel=preload>` — and warm the `getImageProps` candidate
instead (`references/fixes.md`). That one was the 31 s hosted LCP above.

## 3. Audit artifacts — and which of them are real

**axe samples once, and on an animated page it samples mid-animation.** Text
caught at `opacity: 0.4` reads as 1.1:1, so A11y flips 96 ↔ 100 run to run.
Darker text can't fix it. **But it is fixable without changing the design**
(rule, 4+ sites — one hero went from 96 in 5/8 runs → 100 in 8/8):

- Run `tools/qa/axe-sweep.mjs` first: it samples every ~120 ms through the whole
  entrance and names every element that *ever* fails, and when. It also finds
  **real at-rest failures Lighthouse never sees** — text over a canvas (it can't
  resolve a canvas background), an eyebrow at 4.42:1. Its last-sample failures
  are real defects even when Lighthouse says 100.
- First-screen copy: reveal with **transform / clip-path / a soft-edged
  `mask-image` sweep while opacity stays 1** — it paints like a fade. Remove the
  mask at rest. **First screen only**: below the fold Lighthouse never scrolls,
  and masks over glass (`backdrop-filter`) repaint every frame (250–490 ms
  frames, observed twice).
- Or start the fade at a contrast-passing opacity, or serve the copy at rest
  under an opaque curtain (§4).
- Panels that reveal in steps: keep them hidden (`visibility`/`inert`) until
  revealed, so axe doesn't read through a parent fade.

**The robot form at rest shows below-fold colours people do see** after their
reveals — when a robot audit finds contrast failures people-runs never reached,
they are real. Fix the colours (§5).

**Custom reveal clocks bypass the robot switch.** A reveal driven by a
project's own rAF/timeline (not the engine) kept animating on the robot form;
production caught a CTA mid-fade (1.2:1) while localhost finished the fade
before the snapshot. Gate such clocks on `useMotionOff()` / `useRobot()`.

**A CLS of 0 can mean "the trace ended before the shift"** — verify with the
probe before believing a regression or a win.

## 4. Fix, in weight order

Full code in `references/fixes.md`; the robot form in `references/robot-path.md`.

### LCP

- **The LCP waits on a loader / curtain / entrance** (the most common shape on
  animated sites). Serve the LCP copy **at rest under the opaque curtain** in the
  server HTML, switch it to its start state at hydration (still covered) **after
  a reported paint** (a paint `PerformanceObserver`, or rAF → `setTimeout` — two
  bare rAFs lost the race 1 run in 3), then play the same entrance with the same
  config. Nothing visible changes; the LCP is at first paint. **Rule** (3+:
  mobile 64 → 91, 52 → 73, 59 → 85). Then check:
  - **Blur halo.** An entrance that starts each word at `blur(20px)` measured a
    blurred word (62k px²) larger than the whole resting headline (50k px²), so
    the LCP moved back to the entrance. Keep the start blur small enough
    (≤ 14–16 px observed) or blur per line (observed, 2 sites).
  - **A client-only scene draws the LCP heading** → its loading placeholder
    renders the same heading at rest in the server HTML (observed: ~79 → 96).
  - **LCP behind a timed curtain with heavy work under it:** read
    `observedLargestContentfulPaint` (2.85 s observed vs 9.3 s simulated —
    Lantern replays the scene build at 4×). Shrinking bytes moved nothing; the
    lever is when the heavy work runs.
- **LCP = the cookie banner.** The starter now **server-renders it at rest** and
  hides it before paint for returning visitors (an inline script marks
  `<html data-consent>`; CSS hides the banner under that mark and on the robot
  form). Keep it that way: a `dynamic({ ssr: false })` banner paints after
  hydration and Lantern bills it with every request that finished before it.
  **Rule** (10+ sites: mobile 53 → 74 alone, 73 → 99, 87 → 92, 91 → 100). If a
  design holds the banner behind an intro, server-rendering changes consent UX —
  ask. The banner's privacy link must not import `site.ts` (it drags `zod` in —
  below).
- **`priority` on the hero image and nothing else.** A raw `<img>` LCP gets
  `fetchpriority="high"` and its siblings `loading="lazy"`.
- **Fonts are the usual bandwidth competitor.** Local `.ttf`/`.otf` → Latin
  WOFF2 subsets (observed: 352 → 74 KB, mobile 83 → 89; WOFF2 alone moved
  nothing — the subset did); instance away variable-font axes the design pins
  (267 → 51 KB). A font **CDN stylesheet** (Fontshare, Google `@import`) is
  render-blocking from another origin: self-host with `next/font/local`
  (observed: FCP ~2 → 0.8 s). Prefer `next/font/local` over `next/font/google`
  anyway — the latter makes every build depend on Google's network (a deploy
  failed on it). Don't list a face as WOFF2 *and* WOFF.
- **`experimental.inlineCss: true`** in `next.config.ts`, and model / Draco /
  scene-data fetches started **at first paint**, not as `<head>` preloads —
  Lantern bills every download that finished before a late LCP to it. **Rule**
  (3 sites: 87 → 90; LCP 3–5 → 2.5–3.0 s).
- **Media by role.** A hero video encoded for its job — a decent desktop file, a
  smaller phone file via `<source media>`, silent audio dropped (masters shipped
  at 2892×2160, 21–25 Mbps). Below-fold `<video>` is `preload="none"` until its
  section hydrates (observed: a run-to-run LCP flip 2.3 ↔ 3.4 s gone).
- **A preloader counter that rewrites text every frame** costs Speed Index (a
  late layout weighs heavily): draw it to a canvas (observed: SI 5.2 → 4.4 s).

### TBT / hydration

- **Below-the-fold text engines mount near the viewport** — `RobotText lazy`
  (`src/components/common/robot-text.tsx`): plain text until within 1.5
  viewports, then the engine. Never the first screen. **Rule** (mobile TBT
  2,488 → 390 ms alone; 81 → 93, 88 → 98).
- **Hydrate below-fold blocks later** — on approach (`HydrateNear`, observed
  68 → 83) or one per idle moment after load when blocks are heavy (**rule**:
  79 → 86, 84 → 87; on approach janked one site's scroll with 75–100 ms
  hydration frames). **Only once each block is under the long-task limit** —
  splitting 275–395 ms blocks made TBT *worse*. Put deferred blocks in memoised
  components, or a re-rendering parent replaces their server HTML with the empty
  fallback (a FAQ and footer vanished once).
- **Per-letter headings: plain spans until they first play** (observed: 52 → 60).
  **One clock per text effect**, not a spring per character — each character's
  state computed from one time-based spring with the original delays; latch it
  (no restart on re-entry). **Rule** (hand-over task 403 → 103 ms; hydration
  ~240 → ~38 ms; TBT 360 → 63 ms).
- **Hover springs only where a mouse can hover** — render at rest until
  `(hover: hover) and (pointer: fine)` after load, then swap in the real `Hover`
  (`robot-hover.tsx` does the robot half). **Rule** (~60 springs: TBT ~570 →
  ~400 ms).
- **Split the curtain-lift's entrances into their own tasks**, each switched on
  ≈ 120 ms before its own delay so timing is unchanged. **Rule** (88 → 93) —
  then fix the mid-fade contrast it exposes (§3).
- **three.js out of the first load:** `import()` from an effect after first
  paint, not `next/dynamic` alone (observed: LCP 2.8 → 1.8 s). Heavy geometry in
  a Worker; the whole scene in an OffscreenCanvas worker when set-up is one long
  task — `optimize-3d-scene` §3, §15.
- **`zod` out of the client.** Client code imports brand constants from a plain
  module, never `site.ts` → `env.ts`. Check:
  `grep -l ZodError .next/static/chunks/*.js` must print nothing (observed:
  72 → 78).
- **`prefetch={false}`** on links that never navigate in-app.
- **Looping springs under `skipAnimation`** (robot form, reduced motion) restart
  in the same tick forever — the page hangs (`PAGE_HUNG`) or burns ~300 ms per
  load. `loop: motionOff ? false : …` with `useMotionOff()` known on the first
  render. `tools/qa/check-motion.mjs --url …` catches it.

### CLS

Reserve space for anything that grows — images, webfonts, counting numbers
(fixed width / `tabular-nums`). CLS sums distance, not frames: a stiffer spring
doesn't help. A **preloader** is the usual culprit: a bar growing by `height` →
`scaleY()` from its edge; a counter riding on `bottom` → fixed `bottom` +
`translateY()` (observed: CLS 0.489 → 0).

### Best Practices and SEO to 100

- **Linked-but-missing routes** — every `href` must resolve. A cookie-banner
  link to `/privacy-policy` that doesn't exist cost BP 3–4 points on six sites;
  build the page, don't drop the link. Nav items for pages never built point to
  `#` (or the section anchor), never a 404.
- **`object-cover` on percentage-cropped images** (BP "image aspect ratio").
- **The brand kit and metadata** — the starter's placeholders ("New Project",
  `@newproject`, generic icons, a 900×600 share card) shipped to most sites it
  seeded. `seo-audit` §2 has the checklist; `tools/qa/brand-kit.mjs` renders the
  favicon set and a 1200×630 share image from the running hero.
- **Canonical / og:url follow the serving origin** — `siteConfig.url` from
  `NEXT_PUBLIC_SITE_URL` → the host's production domain → localhost, plus
  `origin-sync.ts` after hydration. Fetch the deployed `og:image` and curl it:
  a localhost or 404 image is a broken share preview.
- **The empty `app/loading.tsx` stays deleted.** It wrapped the streamed page in
  `<div hidden>` for non-JS readers — crawlers saw no `<h1>`. It is a crawler
  fix, not a score lever: keep it deleted even when Lighthouse doesn't move.

### Contrast

Arithmetic, not taste. On this starter's surfaces the floor for 4.5:1 is
**black at 0.55 alpha** on light surfaces and **white at 0.46** on black — for
*pure* black; a softer ink raises it (`#111` on white needs 0.6). Large text
(≥ 24 px, or 19 px bold) needs 3:1. Add a new Tier-1 alpha and repoint the
semantic token — don't raise the shared raw value (borders share it at 3:1).
Decorative text that must stay dim → CSS generated content (`content:`), not
text — but switch to it after the cover lifts, not at first render (doubled
hydration once). `target-size`: 24 px centres, measured on rendered boxes
(trimmed leading lies; a negative-margin pad doesn't pass); look for an
overflowing row first. Let a control's visible text name it rather than
replacing it with `aria-label`.

## 5. Report honestly

The full grid before and after, which cells meet the bar and which don't. Then:

- what you changed and which measurement blamed it;
- **what you did not fix and why** — anything capped by a design decision gets
  its measured cost, for the client to decide. Never rewrite the design, copy,
  layout or brand to win points; never remove a 3D scene on mobile without the
  client's sign-off;
- what you reverted (and its numbers) — reverted attempts are findings;
- audit artifacts you left, and why.

## 6. Close the loop

`yarn lint` · `npx tsc --noEmit -p .` · `yarn build` · `.claude/scripts/verify.sh`
(zero FAILs) · `qa-verify` if any UI changed (a contrast fix changes the look) ·
`mobile-device-qa` if anything a phone shows changed. Then the vault: the grid in
`obsidian/meta/changelog.md`; an ADR for anything that sets a rule or accepts a
cost; a measured fix → `obsidian/knowledge/fix-catalog.md`; what misled you →
`obsidian/knowledge/pitfalls.md`.

## Related

[[optimize-load]] · [[optimize-performance]] · [[seo-aeo]] · [[ship]] · [[qa-verification]] · [[mobile-device-qa]] · [[testing-pipeline]]
