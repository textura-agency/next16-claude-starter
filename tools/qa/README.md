# tools/qa — the testing pipeline

Real browsers against a **running production build**. Every tool takes
`--url`, writes its evidence to `reports/qa/<tool>/<stamp>/` (gitignored),
prints a plain-language summary, and exits **0 = pass, 1 = the verdict failed,
2 = the tool could not run**. No tool needs anything but the URL.

These instruments and their thresholds were built while measuring and fixing
~50 production Next.js sites. Every guard in them exists because a tool once
reported something false without it — the pitfalls section says which.

```sh
yarn qa:setup                                  # once per machine (deps go to ~/.cache/next16-qa)
yarn build && yarn start -p 4500               # a PRODUCTION build — never `next dev`
yarn qa:lh --url http://localhost:4500/        # …then any tool below
```

## Setup

`node tools/qa/setup.mjs` installs Lighthouse, puppeteer-core, chrome-launcher,
axe-core, Playwright (+ its WebKit build) and pngjs into a cache dir **outside
the project** — `~/.cache/next16-qa`, or `NEXT16_QA_CACHE=/dir`. The site gains
no dependency and its lockfile never moves; every tool resolves its packages
from there (`tools/qa/lib/deps.mjs`) and says so plainly if setup wasn't run.
`--check` reports what's installed. Needs **Google Chrome** installed
(`CHROME_PATH` to point elsewhere): the tools drive the real browser with the
GPU on, never a bundled Chromium.

## Which tool answers what

| question | tool | `yarn` | verdict |
|---|---|---|---|
| Is it in the green on PC and phone? | `lighthouse.mjs` | `qa:lh` | median perf ≥ 90, A11y/BP/SEO ≥ 100 |
| Does it hitch while you scroll it? | `scroll-test.mjs` | `qa:scroll` | `ideal` on PC + phone |
| Does a finger drag move the page at all? | `scroll-test.mjs --touch-drag` | `qa:scroll --touch-drag` | every drag moves it |
| Which code is in that long task? | `profile.mjs` | `qa:profile` | diagnostic (`--budget` to gate) |
| Does the iOS URL bar resize / blank the scene? | `ios-toolbar-probe.mjs` | `qa:ios` | no resize on height-only changes |
| Does the scene really draw at the page's rate? | `fps-probe.mjs` | `qa:fps` | scene fps ≥ 0.8 × page fps |
| Does the scene come back after a lost WebGL context? | `context-loss-probe.mjs` | `qa:context` | draws again after every loss |
| Does any element fail contrast / target size, at any moment? | `axe-sweep.mjs` | `qa:axe` | nothing failing at rest |
| Does a resized window land where a fresh load does? | `resize-check.mjs` | `qa:resize` | boxes match a fresh load |
| Is it alive with motion off, and can crawlers read it? | `check-motion.mjs` | `qa:motion` | no hang, h1 not hidden |
| A still of the scene for the robot form | `capture-still.mjs` | `qa:still` | still not blank |
| Favicons + share image from the mark and the hero | `brand-kit.mjs` | `qa:brand` | share image not blank |
| iOS-only canvas bugs (WebKit, touch flicks) | `webkit-probe.mjs` | `qa:webkit` | every on-screen canvas shown + drawing |

The mechanical source checks are `.claude/scripts/verify.sh` (`yarn verify`) —
run it first; it takes a third of a second.

**When:** before shipping any page — `verify.sh`, `lighthouse`, `scroll-test`,
`axe-sweep`, `check-motion`. A page with a WebGL/canvas scene adds
`fps-probe`, `ios-toolbar-probe`, `context-loss-probe`, `webkit-probe`. After
any layout change that touches breakpoints: `resize-check`. Chasing a number:
`profile`. Launch prep: `brand-kit`, `capture-still` (if the robot form shows
a still), `lighthouse --as-bot`.

## Which element scrolls — `lib/scroller.mjs`

Every tool that scrolls goes through **one** helper. Most pages scroll the
document; some lock `<html>`/`<body>` (`overflow: hidden`) and scroll an inner
element instead — a full-screen `overflow-y: auto` div, or Lenis with its own
`wrapper` (often so iOS's toolbar never collapses). There `scrollY` stays 0, the
document is one screen tall and `window.scrollTo` does nothing: before the
helper, the scroll test recorded such a page as "static / one screen, 0 px" and
**passed** it, and every probe judged its first screen only.

- `SCROLLER` is installed in the page before any script (`installScroller(page)`,
  puppeteer or Playwright) and defines `window.__scroller()` — Lenis's wrapper
  element if Lenis runs on one; else the document when it is taller than the
  viewport; else the first `overflow-y: auto|scroll` element ≥ 75 % of the screen
  tall whose content overflows (four levels under `<body>`, the whole tree on a
  fresh look) — plus `__sy()`, `__vh()`, `__max()`, `__to(y)`, `__by(dy)`,
  `__top()`, `__stepTo(y, px, ms)`, `__yOf(el)`, `__locked()`.
- Node side: `scrollToFraction(page, f)`, `scrollToY`, `scrollToSelector`
  (`{ stepPx, stepMs }` to scroll in steps so the page's scroll handlers fire),
  `scrollState(page)`, `zeroScroll(from, to)`.
- **A long page that scrolled 0 px is an error in every tool, never a pass** —
  and so is a page whose document is one screen while some other big element
  scrolls (`__unclaimed()`: a scroller the helper could not take). The message
  names the scroller; teach the helper rather than relaxing the check.
- On a window-scrolled page every helper is exactly the old `window` call.

## The tools

### lighthouse.mjs — load, a11y, best practices, SEO
`--url` · `--runs 3` · `--devices desktop,mobile[,tablet]` · `--as-bot [--bot googlebot|gptbot|pagespeed]` ·
`--ab <reference-url>` · `--header "k: v"` · `--min-perf 90 --min-other 100` · `--timeout 180`

PC 1440×900 (40 ms RTT, 10 Mbps, 1× CPU) and mobile 412×823 @1.75 (slow 4G,
4× CPU) — Lighthouse's own simulated throttling. Medians of ≥ 3 runs per
profile; each run's HTML report in the report dir; prints the per-run spread,
the LCP element and the weighted failing audits.
- `--as-bot` audits the **robot form** (`src/proxy.ts` serves it to crawler
  UAs) — Googlebot by default, `--bot gptbot` for AI crawlers, `--bot pagespeed`
  for PageSpeed Insights' Chrome-Lighthouse UA. Keep robot and people records
  apart; never compare one with the other.
- `--ab <ref>` interleaves runs **ref, candidate, ref, candidate…** so both
  arms share the machine's load at that moment. The only fair way to compare
  two builds locally.
- Each run has a timeout; a hung run's Chrome is killed (a hung Lighthouse
  otherwise orphans its Chrome, which then steals CPU from every later run).
  The tool also lists Chromes an earlier hung run left behind.

### scroll-test.mjs — the bar Lighthouse can't see
`--url` · `--devices desktop,mobile` · `--runs 3` · `--first-scroll` · `--touch-drag` · `--video` · `--headless` · `--accept ideal|smooth` · `--header`

A **visible** real Chrome (headless GPU behaviour differs) scrolls the whole
page like a person: PC 1440×900 @2 with wheel bursts of about a viewport;
phone 390×844 @3 with touch flings, **4× CPU, 4G**. Each run is a fresh
profile: a **cold** pass (first visit — empty HTTP and decode cache), back to
the top, then a **warm** pass (second visit). One unrecorded warm-up per
device first, so the server's image optimizer has encoded every size (the
first run after `next start` otherwise measures the encoder).

| verdict | cold **and** warm, medians of runs |
|---|---|
| **ideal** | no frame > 50 ms · ≤ 1 % dropped · p99 ≤ 33 ms |
| **smooth** | no frame > 100 ms · ≤ 3 % dropped |
| **janky** | anything else |
| **incomplete** | the pass didn't reach the bottom (locked, pinned, not ready) — not a result |

Budgets are 60 Hz even on a 120 Hz screen. Every freeze prints as
`258ms  3/3  cold  decode (media fetched just before)  section "Catalogue"`:
worst ms · in how many runs it reproduced (**3/3 is a bug, 1/3 re-run first**)
· pass · cause · the section under the viewport's centre. Causes:
`script` (the long-animation-frame names the file and function),
`script: React render` (React's scheduler — state set on scroll / in view),
`script: React mounting a lazy chunk` (a `dynamic()` component loading inside
the scroll — preload it after `load`), `render (style / layout / paint)`,
`decode (media fetched just before)`, `gpu / raster (main thread idle)`.
**Cold bad, warm clean** = first-visit work inside animating frames (the
commonest shape). Janky with no frame > 100 ms = sustained cost — the tool
prints dropped frames **by section**.
`--first-scroll` adds a pass that scrolls **from the unlock frame** (a person
wheels the instant a loader lets go; the main pass starts ~1 s later and
missed exactly that moment on one site). A one-screen page is judged with
pointer sweeps instead (`static`) — but only when the page's **scroller** is
one screen: a long inner-scroller page is scrolled through that element, and a
long page that moved 0 px in both passes is an **error**. `--video` records one
extra, unmeasured run per device (needs ffmpeg) — look at it, then delete it.

`--touch-drag` runs **only** a touch check (~20 s, phone profile, headed unless
`--headless`): a real finger drag via CDP `Input.dispatchTouchEvent`
(touchStart → 12 moves over 40 % of the screen → touchEnd — not a synthesized
gesture) starting **on** each fixed, visible element covering ≥ 60 % of the
screen (else the centre), then a wheel at the same spot. FAIL when the finger
moves the page 0 px; it prints what the finger hit and the wheel result. Why:
Chrome chains a touch scroll along the **containing block**, not the DOM — a
`position: fixed` panel inside a fixed inner scroller with the document locked
chains to the locked viewport and swallows every drag, while a wheel can still
work (wheel events bubble). Observed on a production site: phone scroll coverage
0 % → 100 % after `pointer-events: none` on those panels (and a fixed cookie
banner) on coarse pointers, `auto` again on their controls, links and canvases.
Run it on any page that locks the document or pins full-screen layers.

### profile.mjs — which code is in the long task
`--url` · `--device mobile|desktop` · `--wait 8000` · `--scroll-to <sel|px>` · `--as-bot` · `--top 3` · `--budget <ms>`

CPU-profiles a cold load (4× CPU on mobile, GPU on, people UA, one unprofiled
load first) and prints the busiest runs of main-thread work: self time by
package/file, library calls and **your own functions** by inclusive time.
`load.cpuprofile` opens in DevTools → Performance. Names are original only
when the build ships browser source maps — profile a build made with
`QA_SOURCEMAPS=1 yarn build` (next.config.ts turns them on only then; never
deploy that build); otherwise
time is attributed per chunk. `--scroll-to` covers work that starts mid-scroll
(40 px a frame, through the page's scroller; a long page that doesn't move is
an error).

### ios-toolbar-probe.mjs — Safari's URL bar
`--url` · `--sel <canvas>` · `--wait 9000` · `--scroll 0.3` · `--heights 844,760,844,760,844,700,844` · `--rotate 844x390` · `--no-isolate`

Safari's toolbar changes the viewport **height** while you scroll. A scene
sized `100dvh` / `fixed inset-0` / `innerHeight` follows it: its buffer is
reallocated (cleared → a blank frame), it re-randomises, or (an r3f `<Canvas
frameloop="never">` re-applied on re-render) stays black. Emulated iPhone;
steps the height at a fixed width and follows **one** canvas (`--sel`, else the
largest on screen at the start, re-found in place if a rebuild replaces it):
buffer, box, parent box, attribute writes, worker size messages, draw calls,
two isolated shots per step scored for blankness. Then a rotation must resize
the same canvas, and rotating back must leave it drawing.
Fix: `src/utils/stable-viewport.ts` + `src/components/common/scene-viewport.tsx`
(large-viewport height, re-measured on touch devices only when the **width**
changes; skip same-size resizes; draw at once on a real one).

### fps-probe.mjs — the scene's real frame rate
`--url` · `--device mobile|desktop` · `--wait 9000` · `--cpu 4` · `--scroll-start <px>` · `--min-ratio 0.8`

Counts, **per canvas**, the frames it draws against the frames the page gets,
5 s at rest and 5 s scrolling, headed Chrome, only while that canvas is on
screen. A `t - last <= 1000/30` cap draws every 3rd frame at 60 Hz (20 fps)
and every 5th at 120 Hz (26 fps) — it passes Lighthouse and the scroll test
and looks bad on a phone. Lifting it measured 26 → 120 fps with the phone
scroll the same or better on five sites. Worker (OffscreenCanvas) scenes can't
be counted on the page's thread; the probe says so.

### context-loss-probe.mjs — the scene after a lost context
`--url` · `--sel <canvas>` · `--cycles 4` · `--wait 11000` · `--grace 2500`

iOS drops WebGL contexts under memory pressure; a page that never rebuilds
shows a permanent blank ("scroll the page and back → the hero is gone").
Emulated iPhone, follows one canvas: away and back `--cycles` times, then
`WEBGL_lose_context` while away (no restore / browser restore) and while on
screen. After each return: a canvas, a live context, draw calls, a lit buffer
(the probe forces `preserveDrawingBuffer` to read it), and the time to the
first lit frame. Fix: `src/lib/scene/webgl-context.ts` (`keepSceneAlive`).

### webkit-probe.mjs — the iOS-only bugs
`--url` · `--device "iPhone 13"` · `--iterations 2` · `--wait 9000` · `--shots` · `--faults` · `--gpu-kill` · `--headed`

Headless Chrome missed an iOS-only "the hero disappears" bug **twice**. This
runs Playwright's **WebKit** with an iPhone profile and scrolls like a thumb:
partial flicks, past the first screen and back, to the bottom and back, quick
reversals, a URL-bar height change mid-fling, a jump and a status-bar tap to
the top, a slow return after sitting at the bottom. At each stop, for **every
canvas** on screen: shown (opacity/visibility/display up the tree), context
state, still drawing, and its region in a real screenshot vs its first good
frame. Rule from production: **never stop drawing a visible WebGL canvas on
iOS** — iOS drops the last frame after a toolbar resize; pause only off
screen. `--faults` loses contexts at the worst moments, including the
**rebuild's own fresh context** within its first milliseconds (the hole a
simple handler leaves); `--gpu-kill` kills WebKit's GPU process (macOS) the way
iOS jetsam does. Flicks are driven per frame inside the page (Playwright can't
synthesise native touch scrolling in WebKit), so the engine fires the scroll
events itself. `fail-*.png` — look at them.

### axe-sweep.mjs — contrast and target size at every moment
`--url` · `--device desktop|mobile|both` · `--ms 9000` · `--step 120` · `--robot` · `--strict` · `--rules`

Runs axe every 120 ms from navigation as a person. Lighthouse samples one
moment — mid-fade on some runs (A11y flipping 96 ↔ 100 between identical runs)
— and never checks an element still at opacity 0 when it looks.
**At rest** (failing in the last sample) = a real defect even when Lighthouse
says 100 (it can't resolve text over a canvas: labels at 1.76:1 passed it).
**Transient** = a fade caught mid-way; darker text can't fix it — start the
fade from a contrast-safe state or shorten it. `--robot` audits the robot
form at rest (it renders below-fold content Lighthouse never scrolled to —
real failures surface there).

### resize-check.mjs — live resizes vs fresh loads
`--url` · `--sel "canvas,main,h1,header,footer"` · `--tol 2` · `--settle 1500,4000` · `--only <names>` · `--hide <sel>`

Seven paths, each compared with a fresh load at the end size: real window
jump / slow drag / widen from a page read to the bottom (`Browser.setWindowBounds`
— `page.setViewport` is **not** a window resize and passed a page a real resize
broke), DevTools device preset and back (DPR 3, mobile, touch), Responsive-mode
drag, tablet rotation. Prints box / scroll / height / horizontal-overflow
differences and PSNR, and writes a strip per path (resized at each settle
moment | fresh). A 3D product kept its desktop framing with every box matching
— only the pixels showed it: **look at every strip**.

### check-motion.mjs — motion off, and crawlers
`--url` · `--wait 3000`

Loads as a person with `prefers-reduced-motion`, as Googlebot and as GPTBot,
and asks the page for `1 + 1` with a 5 s deadline: a `loop: true` spring under
`skipAnimation` restarts in the same tick forever and the tab is dead (live on
several production sites; fix `loop: !useMotionOff()`). Reports long-task time
at rest (a loop restarting instantly costs ~300 ms a load). Then fetches the
**served HTML** as Googlebot and GPTBot (no JavaScript) and checks the first
`<h1>` is not inside a `hidden` element — an `app/loading.tsx` streams the page
into `<div hidden>`, and crawlers that run no JS read nothing.

### capture-still.mjs — the robot form's stand-in for a scene
`--url` · `--save public/assets/<name>` · `--device desktop,mobile` · `--wait 8000` · `--transparent` · `--canvas <sel>` · `--clip` · `--keep` · `--hide` · `--scroll-to` · `--quality 80`

Loads as a person, waits out the intro, hides everything but the canvas, and
writes WebP stills (1440×900 @1, 412×915 @2). Without `--save` they go to the
report dir — look first. `--wait` must cover the **scene's** entrance, not
just the loader (12 s caught one scene as an empty star field; 22 s whole).

### brand-kit.mjs — favicons and the share image
`--icon <mark.svg>` · `--url` · `--bg` · `--og-wait 9000` · `--og-hide` · `--og-width` · `--og-scroll` · `--icon-full` · `--skip-og` · `--skip-icons` · `--dry`

Renders a hand-drawn square mark (logomark or monogram, never the wordmark)
into `icon.svg`, `favicon.ico` (16/32/48), the 16/32 PNGs, the 180 px apple
icon (flattened on `--bg`, default `siteConfig.backgroundColor`), the android
sizes, 512 + maskable 512; and captures the share image at 1200×630 from the
running hero as a returning visitor, at the path `siteConfig.ogImage` names.
It does **not** write a web manifest — `src/app/manifest.ts` builds it from
`siteConfig`. `--dry` writes into the report dir only. Prints what to wire.

## Reading results — what measuring taught

- **Production build only.** `next start`, never `next dev` (unminified, dev
  overlay, HMR; on `127.0.0.1` Next 16 dev may never hydrate at all —
  use `localhost`). The tools refuse a URL that looks like dev (`--allow-dev`
  overrides for "does it break" probes, never for numbers). After a failed
  build `next start` happily serves the **previous** `.next` — gate on the
  build's exit code and confirm the served HTML carries your change.
- **Medians of ≥ 3 runs, PC and phone.** One run is an anecdote: identical
  runs swung LCP 2.7 → 4.6 s and CLS 0 → 0.18. A perf spread over ~8 points →
  `--runs 5`. Never report a win you didn't re-measure the same way.
- **Localhost LCP is not the site's LCP.** It bills every early request to LCP
  (~4–6 perf points on asset-heavy pages) — or, the other way, hides the real
  host entirely (4.8 s local vs 31 s hosted on one site). Judge a local change
  by **TBT and CLS**; confirm load on the deployed URL. A local run can also end
  before a late layout shift a hosted run catches.
- **Compare builds interleaved, under the same load** (`lighthouse --ab`).
  The machine's load moves Lantern's TBT ~2×; above a load average of ~15 (any
  of the three numbers — the tools warn) scroll and Lighthouse verdicts are
  unreliable. One record near a threshold is a draw, not a verdict.
- **People UA vs robot UA.** Puppeteer's default UA says `HeadlessChrome` — a
  bot to `src/proxy.ts` — so a probe would test the robot form (no scene, no
  loader) and "prove" a bug gone that a person still sees. Every tool sets a
  plain browser UA; robot runs are explicit (Googlebot, GPTBot, PageSpeed).
- **GPU on.** No `--disable-gpu`: a software-GL fallback bills SwiftShader to
  the page, and a WebGL scene may never build under it (one profile was 11.8 s
  idle of 12). Headless fps is not real fps — only **counted** things transfer
  (draw calls, long tasks, program links). Nothing here throttles the GPU: fill
  rate and overdraw need a device or the counted checks.
- **What localhost hides:** an image a 4G phone receives mid-scroll arrives
  instantly here. Treat any `fetched` during a scroll pass as a freeze waiting
  for a slower link.
- **Lighthouse's task times are simulated** — map a long task to code with
  `profile.mjs`, never by lining "711 ms at 3.4 s" up with the page's timeline.
- **A puppeteer timeout isn't proof of a frozen page** — check with a trivial
  `evaluate` first (a page cancelling the wrong timer id once looked frozen).

## Pitfalls running them

- **Kill servers by port.** `next start` runs as `next-server`;
  `pkill -f "next start"` misses it: `lsof -t -iTCP:4500 -sTCP:LISTEN | xargs kill`.
  A stale server holds the port and serves an old manifest; one started before
  files landed in `public/` 404s them until restarted. Stop your servers when
  done.
- **macOS has no `timeout`** — `timeout 420 node …` fails with "command not
  found", which reads like a failed measurement. The tools time out internally.
- **A hung Lighthouse orphans Chrome** (`lighthouse.XXXXXX` user-data-dir) —
  `lighthouse.mjs` kills its own and lists stray ones; kill those before a run.
- **The scroll test opens a window** — leave it visible; an occluded window
  gets its frames throttled.
- **Headless height steps shrink `lvh`/`vh` with the window**; a real iPhone's
  toolbar doesn't. A canvas sized in pure CSS `100lvh` can fail
  `ios-toolbar-probe` and be fine on a phone — confirm in `webkit-probe`.
- **Several canvases:** pass `--sel` for the scene's canvas. The probes follow
  one canvas across steps (an older probe followed "the largest canvas" each
  step and in landscape jumped to a different one — a false FAIL).
- **"static", "one screen", `y=0` or 0 px on a page you know is long** — the
  record is void, not a pass. The tools now say so themselves; if one ever
  doesn't, the page scrolls something `lib/scroller.mjs` didn't find.
- **Protected deployments:** `--header "x-vercel-protection-bypass: <secret>"`
  (lighthouse, scroll-test).
- **zsh** doesn't word-split `$list` in `for x in $list` — use an array.
