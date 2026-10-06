---
tags: [knowledge, pitfalls, performance, stable]
updated: 2026-10-06
---

# Pitfalls

Things that looked like a win, a cause or a pass — and were not. Each one cost
real time on a production site built from this starter. Read the section that
matches what you are about to do **before** acting on a hypothesis. The fixes that
did work are in [[fix-catalog]]; how to add to either: [[knowledge/README]].

## 1. Measurement

- **A single Lighthouse run is an anecdote.** LCP swung 2.7 → 4.6 s and CLS
  0 → 0.18 between identical runs of one build. Medians of ≥ 3; read the spread;
  if Performance varies > ~8 points, use 5 runs.
- **Lighthouse can simulate the same page's LCP two ways.** One unchanged live
  site scored 89, 90, 68, 90, 68 in one sitting (simulated LCP ~0.85 s or ~4.6 s
  for an observed ~4.9 s). A 3-run baseline that lands fast twice looks like a
  regression next to a build that lands slow. Compare
  `metrics → observedLargestContentfulPaint`, and A/B back to back.
- **Localhost LCP is a floor — sometimes a fantasy.** Same build: mobile LCP
  **4.8 s local → 31.0 s on the real host** (perf 70 → 56). Simulated 4G only
  bites on a real host — on localhost 11.5 MB of raw PNGs didn't hold anything up.
  The reverse also happens: on asset-heavy pages localhost **over**-bills LCP by
  4–6 points (HTTP/1.1, every early request lands before first paint) — local
  2.9 s vs production 1.3–1.6 s. Iterate locally, judge load on the host.
- **The machine's load moves TBT 2×.** Lighthouse traces unthrottled and
  multiplies task lengths by 4, so a busy laptop (another Chrome at 30–40 % CPU,
  a screen recorder, parallel builds) reads TBT 390 → 700 ms on the same deploy.
  Check `uptime` / `sysctl -n vm.loadavg` before a record; above a load of ~15 in
  any of the three averages a scroll verdict is unreliable — re-run, don't act.
  Run A/Bs interleaved so both arms see the same load.
- **One scroll record near the 1 % line is a draw.** Desktop read 0.21 % then
  2.83 % on consecutive hosted records; both builds spread 1–14 % cold. A/B two
  builds back to back (≥ 2 rounds) and compare per-frame work before calling a
  regression.
- **Lighthouse's long-task times are simulated.** A "711 ms task at 3.4 s" was a
  ~180 ms task at 0.5 s in the observed trace. Map tasks to code by the observed
  trace (or a source-mapped CPU profile), never by lining the simulated time up
  with your own timeline.
- **Lighthouse blames whoever owns the rAF.** It billed 1.0 s to react-spring on a
  page whose WebGL scene rendered from the shared ticker; a real-throttle profile
  showed **no** long task — just 14 s of small frames that Lantern multiplied.
  A page drawing WebGL from frame one has a TBT floor no user feels. Read a
  chunk's *self* time in a real profile before touching what Lighthouse names.
- **Lantern bills a late LCP with every download that finished before it.** A
  banner painted after hydration was charged with a 1.5 MB model preloaded in the
  head (simulated LCP 11.1 s, observed 0.68 s). Bytes landing after the observed
  LCP are free. Move the LCP earlier; don't drop the scene's preload.
- **Lantern LCP ≈ TTI when heavy work precedes a timed reveal.** Shrinking a video
  2.4 → 0.47 MB moved nothing; the lever was *when* the scene built, not its size.
- **Lighthouse bills layout two ways** — about half its CPU for TBT, but heavily
  in Speed Index late in the load. Moving work around a preloader can help one and
  hurt the other; check both.
- **CLS 0 can mean the trace ended before the shift**; a plain local run can miss
  a late CLS that the host shows. Confirm with a `PerformanceObserver`.
- **axe samples mid-animation.** Text at `opacity: 0.4` reads 1.1:1; darker text
  can't fix a sample. Check the robot form (at rest): 100 there means the failure
  is the sample. And the reverse: **Lighthouse A11y 100 can hide real at-rest
  failures** over a canvas (it can't resolve the background; `qa:axe` found
  1.76:1 labels) or below the fold (Lighthouse never scrolls). Read `qa:axe`'s
  *last-sample* failures as real.
- **A robot form at rest audits everything** — expect A11y to dip when it starts
  rendering all content, and fix the colours; they are real.
- **Headless fps is not real fps.** Only counted things transfer from headless
  Chrome: draw calls, vertices, program links, long-task durations. The Mac's GPU
  is not a phone's.
- **The scroll test's "first scroll" is ~1 s after the page unlocks.** A person
  wheels the instant the loader lets go — a build and hydration landed exactly
  there on one site and the test never saw it. Probe a wheel from the unlock frame.
- **A pass that scrolled nothing scores "ideal".** Coverage < 95 % is
  `incomplete`, not a verdict. A swipe that starts on a fixed bottom banner doesn't
  scroll; the first run after `next start` measures next/image's encoder (one
  unrecorded warm-up per device).
- **Localhost hides lazy-load freezes** — anything `fetched` during a scroll pass
  is a freeze waiting for a slower link.
- **A puppeteer timeout is not a frozen page.** Check with a trivial `evaluate`
  first (a cleanup that called `clearTimeout` on a `requestIdleCallback` id
  cancelled the probe's own timer — the id counters overlap; keep the id's kind).

## 2. Tooling traps

- **Puppeteer's default UA gets the robot form.** `HeadlessChrome` is a bot UA:
  no loader, no motion, no scene, no cursor — a probe "proves" a bug gone that a
  person still sees. Set a plain Chrome UA in every probe (the `tools/qa/` tools
  do). Lighthouse run by a person (DevTools, PageSpeed) also gets the robot form.
- **Headless height-step probes shrink `lvh`/`vh` with the window** — a real
  iPhone doesn't. Compare positions relative to the section, not the page.
- **`page.setViewport` is not a window resize.** A viewport change passed while a
  real resize left a model at desktop size. Test live resizes with CDP
  `Browser.setWindowBounds` (one jump and a slow drag) **and in DevTools device
  mode** (DPR + mobile + touch at once) — `qa:resize`.
- **Listening only for `orientationchange` on touch breaks real resizes**
  (DevTools back to desktop, foldables, split screen). Listen for `resize`, ignore
  it only when the width is unchanged.
- **Chrome ≠ WebKit for iOS bugs.** Two fixes for a vanishing hero passed every
  headless Chrome probe and failed on the phone. For an iOS-only bug, reproduce in
  a WebKit engine (Playwright WebKit, iPhone profile — `qa:webkit`) or on the
  device before fixing. Still unproven that WebKit headless catches every case —
  the device is the arbiter.
- **A failed build A/Bs the old build against itself.** `next start` happily
  serves the previous `.next`. Gate the server start on the build's exit code and
  `curl … | grep <new attr>` before measuring. Likewise an edit that silently
  didn't apply (a `str.replace` that didn't match) makes an A/B a replicate —
  `grep -c` the change first.
- **`next start` runs as `next-server`:** `pkill -f "next start"` misses it; kill
  by port (`lsof -t -iTCP:<port> -sTCP:LISTEN | xargs kill`). A stale server
  serves an old manifest (404s/500s that aren't yours); a server started before
  files land in `public/` 404s them until restarted. Stop every server you started.
- **`next dev` on `127.0.0.1` never hydrates** (Next 16 `allowedDevOrigins`) — a
  canvas stays 300×150, a loader sits at 0 %. Use `http://localhost:<port>`. And
  never measure `next dev`.
- **A git worktree with a symlinked `node_modules` breaks Turbopack** — use an
  APFS clone (`cp -cR`) or `git stash` for A/B. Build baselines from
  `origin/main` (a local `main` can be stale), never copy `.next/` or
  `node_modules/` (a copy filled the disk), delete it when done.
- **A scripted edit can rewrite a CRLF file's every line** (Python text mode).
  Use `newline=""` or an editor tool; `git diff --stat` after any scripted edit.
- **A regex insert into a CSS selector list blanked a page** — inserting before
  `\nbody {` split `html,\nbody {`, `html` took `display: none`. tsc, lint, build
  and verify all passed. After any scripted/scaffolded change, load the page in a
  real Chrome and look. Append rather than insert mid-file; never overwrite an
  existing file from a scaffold without merging.
- **Checkers: anchor class patterns and skip comments.** `\bduration-fast\b`
  matched the correct `duration-[var(--duration-fast)]`; a comment forbidding a
  pattern failed the check. Test a new check against a correct line too.
- **`vercel build` leaves `.vercel/output`**, and lint walks it. Delete it.
- **A repo-local git email can block every Vercel deploy** (`TEAM_ACCESS_REQUIRED`)
  — check `git config --local user.email` when production stops updating.
- **zsh:** `$b:r…` is a path modifier (`git push origin $b:refs/heads/main` pushed
  nothing — brace it, `"${b}:refs/heads/main"`); `for p in $list` doesn't
  word-split (use an array or `${=list}`); a `pgrep -f "x"` wait loop matches its
  own shell — anchor the pattern. macOS has no `timeout`.
- **Print success from exit codes**, never unconditionally — a loop that echoed
  "merged" hid a push that did nothing.

## 3. Fixes that aren't

- **The loader is rarely the LCP culprit.** Removed entirely: TBT −20 ms, two of
  three profiles scored worse. Read the LCP phases.
- **`<Suspense>` around sections to split hydration made TBT worse** (393 → 834 ms)
  — the boundaries hydrated together, later, as one task.
- **`startTransition` around a remount that isn't the long task does nothing.**
  Read the task's anatomy first.
- **Fixing a hydration mismatch didn't move hosted TBT** — worth fixing (a console
  error, correctness), not worth promising a number for.
- **Idle hydration doesn't help when each block is itself a long task**; lazy-
  loading three.js turned one long task into two (TBT 543 → 860–1230). Cut work
  per block first.
- **Prewarming a scene after `load` trades the scroll for Lighthouse** (−9 mobile,
  −27 PageSpeed). Prewarm in steps at the mount.
- **`compileAsync` only helps if the program key matches** (tone mapping, target,
  colour space, light count). Check `renderer.info.programs` before/after.
- **Deferring 3D preloads to "after the entrance" lands them on the first scroll**
  (~700 ms stalls). Defer to idle well after first interaction, or not at all.
- **`setTimeout(0)` chains don't give the browser a frame.** Step per
  `requestAnimationFrame` when the goal is one step per frame.
- **A worker scene on desktop cost scroll smoothness** (0 → 5 % dropped); on
  phones, at full rate, it competed with the page (ideal → smooth). Phones only,
  paced, started after load.
- **`will-change` everywhere** — a layer and GPU memory each; a permanent one on
  per-character spans made ~970 ms frames. Promote only while animating.
- **`content-visibility: auto` on animated sections** pays the skipped render in
  the frame the section appears.
- **Dropping image `quality` globally** — decode cost tracks pixels. Fix `sizes`.
- **Warming a page by pre-scrolling it** consumes every `mode="once"` reveal.
- **A known-expensive CSS property isn't necessarily the cost you're seeing.**
  Switching off `background-attachment: fixed` moved 53 → 50 dropped frames; the
  real cost was a CSS variable written on `<html>` every frame. Profile the
  section before touching the most suspicious-looking CSS.
- **Speeding up a geometry animation doesn't reduce CLS** — CLS sums distance.
- **Cutting particle counts can break structures drawn from the same pool** — a
  grid filled row by row came up a third short mid-wipe. Check every structure at
  its transition frames.
- **An opaque full-screen overlay's removal frame rasters everything under it** —
  overlay at opacity 0.999 lets the stage paint underneath (175 → 75 ms).
- **Padding a link with `py-x -my-x` doesn't pass `target-size`** — it overlaps
  neighbours, which is what the audit measures.

## 4. Code traps

- **A looping spring freezes the page under `skipAnimation`.** `loop: true` (or an
  `await`-spring `while` loop) completes each leg instantly and never yields —
  `PAGE_HUNG`. `skipAnimation` is on for the robot form **and every visitor with
  `prefers-reduced-motion`**. Decide on the **first render** (`useMotionOff()`);
  react-spring's `useReducedMotion()` reports `false` until its effect runs — too
  late. A comment saying the loop "respects skipAnimation" is the tell.
- **A `<Spring mode="once" enabled={inView}>` replays** — the engine checks
  `enabled` before `once`. Latch the flag in the caller (`seen`), never edit the
  engine.
- **Returning `null` instead of a `dynamic({ ssr: false })` element on the first
  client render is a hydration mismatch** — gate it in a layout effect.
- **react-spring animated styles can mismatch on hydration** (`"0.5"` vs `0.5`) —
  render a fixed initial style, drive the element after mount.
- **Never rewrite React-managed `<head>` tags before hydration** — React matches
  hoisted `<link>`/`<meta>` by URL; a changed `href` makes it insert a second
  canonical. Rewrite after `load` and remove the stale copy.
- **A config read at import turns an optional env var into a build failure** —
  coerce empty strings to `undefined`.
- **A twin/wrapper that branches on a prop must apply the engine's defaults
  first** (`mode` defaults to `"always"`; a robot twin that checked the literal
  prop showed a modal open).
- **Resting robot text must keep visibility state** — replacing an animation with
  plain spans showed every screen's copy at once; keep the state, drop the motion.
- **An opaque still inside a transformed wrapper covers what's behind it** — put
  `mix-blend-*` on the transformed wrapper (it is the stacking context). Plain
  in-flow text paints *under* positioned scrims the engine's transformed letters
  painted over (`transform: translate(0)` restores the order). Look at both devices.
- **A portal under `<body>` loses CSS variables set on wrappers** — render it
  inside the element that carries them, or copy them.

## 5. Design-to-code traps

- **Phone layouts absolutely positioned from a 390-wide Figma frame** can't take a
  "1rem side padding" request element by element (~30 files on one site). Build
  phones in flow; if inherited, scale the root font so the edge lands at 16 px and
  centre the column (type grows ~14 % at 430 px — tell the designer).
- **Per-letter split headlines break mid-word** ("DA/TA") when each letter is an
  inline-block — wrap each word's letters in a `white-space: nowrap` span.
- **Horizontal overflow zooms the whole phone page out** (a `box-content w-full`
  section with side padding). After any mobile change assert
  `document.documentElement.scrollWidth === innerWidth` at 360–430 px.
- **Menus: `h-lvh` / `inset-0` hide the foot under Safari's bottom bar** — `top-0
  h-dvh` + safe-area padding. Canvases are the opposite (`lvh`).
- **The client's phone is in dark mode.** A menu on a theme-following
  `bg-background` went near-black under fixed-colour text (~1:1). Emulate
  `prefers-color-scheme: dark` on every overlay; give menus their own token.
- **Before redesigning a menu, find which component is actually mounted** — one
  site carried an unused full-screen menu next to the live dropdown.
- **Brand name in the copy disagrees with the logo?** Ask; don't pick silently.
  Wrong titles were the first thing a client caught.
- **A centred fixed-height `body` cuts off the top of a tall page** —
  `justify-content: safe center`.
- **`object-cover` on Figma-cropped images**, or `image-aspect-ratio` fails off
  the comp's breakpoint.
- **A custom cursor never hides the native cursor**, and is off on touch.

## Related

[[fix-catalog]] · [[knowledge/README]] · [[testing-pipeline]] · [[mobile-device-qa]]
