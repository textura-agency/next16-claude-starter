---
name: mobile-device-qa
description: Make a site behave on real phones — the defects no Lighthouse run or headless scroll test sees, learned from site owners reviewing production sites on an iPhone. Covers iOS URL-bar resizes (scene boxes, width-only resize, worker side), WebGL context loss and canvases that stop drawing, 120 Hz speed and frame caps, full-screen mobile menus (dvh + safe area, portals, focus, dark mode), touch sliders, horizontal overflow, split headlines breaking mid-word, custom cursors on touch, gyroscope hero motion, the first scroll after a loader, phone stills, Figma-absolute phone layouts, and reproducing iOS-only bugs in WebKit. Use when the user says "on my iPhone", "iOS", "Safari", "on mobile it…", "flickers when I scroll", "the scene disappears", "low fps on the phone", "too fast on the phone", "mobile menu", "can't swipe", "page zooms out", "gyroscope", "test on real devices", or before handing a site to a client who will open it on a phone.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Mobile device QA

Lighthouse loads a page nobody touches; the scroll test scrolls it in desktop
Chrome with a phone's viewport and a throttled CPU. Neither has Safari's
collapsing toolbar, a 120 Hz panel, a finger, a gyroscope, iOS's memory
pressure or a phone in dark mode. Every item below **passed** both instruments
on production sites and was then found by a person holding an iPhone. This skill
is that person's checklist, with the mechanism, the fix and a way to prove it
without the phone — and an honest line for what still needs one.

Each item: **symptom** (what a reviewer saw) → **cause** → **fix** → **prove it**.
*Rule* = held on ≥ 3 sites; *observed* = 1–2.

**Setup.** `yarn build && yarn start`, `yarn qa:setup` once. Every tool takes
`--url` (`tools/qa/README.md`). Probes run with a person's UA — the default
headless UA gets the robot form (no motion, no scene, no cursor) and "proves"
a bug gone that a person still sees. Look at every screenshot (Read the image).
Copy-paste probes and code shapes: `references/recipes.md`.

**When the bug is iOS-only, reproduce it in WebKit first.** Twice a fix passed
every headless-Chrome probe and failed on the phone (a hero scene vanishing
after scroll). `node tools/qa/webkit-probe.mjs --url …` runs Playwright's WebKit
with an iPhone profile and touch. Reproduce → fix → the same probe passes. If
WebKit can't reproduce it either, ship a fix that removes the mechanism *and* a
self-check that recovers the state, and say plainly it is unverified on iOS.

## 1. The iOS toolbar resizes the viewport mid-scroll

**Symptom:** "the scene flickers when I scroll", "the hero re-renders when I
change scroll direction", "the section resizes on iOS", balls in a physics scene
jump. *Rule* (5 sites).

**Cause:** Safari's URL bar collapses and expands as you scroll: `innerHeight`
changes and `resize` fires. Boxes sized `100dvh` / `100vh`-via-JS /
`fixed inset-0` / `innerHeight` change height; a WebGL renderer that follows
reallocates its drawing buffer (cleared → a blank frame) and redraws; code that
re-randomises or re-lays-out on resize visibly jumps. r3f's `<Canvas
frameloop="never">` re-applies the prop on each re-render — after the second
resize one scene stayed black.

**Fix:**
- Scene boxes at the **large** viewport: `src/components/common/scene-viewport.tsx`
  / `src/utils/stable-viewport.ts` — `100lvh` measured once, re-measured on touch
  devices **only when the width changes** (rotation), a rotation settled ~300 ms
  later. Desktop windows still follow every resize.
- Renderers: skip a resize whose CSS size and DPR didn't change; on a real one,
  draw immediately (`setSize` clears the buffer).
- **Keep listening for `resize`** — never only `orientationchange` on touch: a
  width change (split screen, a DevTools preset back to desktop) then left the
  canvas phone-sized (observed).
- **Worker scenes resize in the worker too** — one OffscreenCanvas worker
  cleared its own buffer on every height step; guard it the same way.
- Anything else that reads `innerHeight` per resize — a scroll-scrubbed section's
  `fit()`, `visualViewport` listeners, `ResizeObserver`s on scene wrappers,
  `ScrollTrigger.refresh` / Lenis recomputes — reads the stable height instead.
- **Static UI is the opposite** (§4): menus use `dvh`.

**Prove it:** `node tools/qa/ios-toolbar-probe.mjs --url … --scroll 0.3` — an
iPhone viewport, height stepped 844 → 760 → 844 → 700 → 844 while scrolled: no
canvas buffer or box change, no worker size message, no blank screenshot, the
loop still drawing; then a rotation that *does* resize. FAIL on production →
PASS on the fix, for every site this was applied to. Headless height steps shrink
`lvh` sections with the window (a real iPhone doesn't) — compare positions
relative to the section, not the page.

## 2. The scene disappears (and never comes back)

**Symptom:** "after scrolling the whole site and back, the hero scene is gone";
"the scene disappears after a little scroll on iOS". *Observed* (1 site, three
review rounds).

**Causes, in the order they were found:**
1. **A visible canvas stopped drawing.** A "freeze the hero after 10 % scroll"
   optimisation trusted the browser to keep the last frame; iOS drops it after a
   toolbar resize / re-composite and a stopped scene never repaints. **Rule now:
   never stop drawing a canvas that is on screen** — pause only when off screen.
2. **A lost WebGL context.** iOS drops contexts under memory pressure (the page
   decoded three 3× stills while the hero was off screen); three.js
   `preventDefault`s the loss but nothing rebuilt the scene.

**Fix:** `keepSceneAlive` in `src/lib/scene/webgl-context.ts` — `preventDefault` the
`webglcontextlost`; on approach (IntersectionObserver with lead), `visibilitychange`
and `pageshow`, check `gl.isContextLost()` and rebuild a lost *or* restored scene
on a fresh context **at rest** (no intro replay), ≥ 1 s apart, 3 retries;
`forceContextLoss()` on every teardown (a rebuild never holds two contexts); don't
allocate desktop-only render targets on phones; a live scene re-sizes only if its
buffer is actually stale.

**Prove it:** `node tools/qa/context-loss-probe.mjs --url …` — scroll bottom ↔
top cycles, `WEBGL_lose_context.loseContext()` off screen (with and without a
restore) and on screen, assert the hero draws again with the same lit-pixel
count. Then `tools/qa/webkit-probe.mjs` with touch momentum, since Chrome did not
reproduce the original bug. Say "unverified on a real iPhone" if it is.

## 3. Frame rate and speed on 120 Hz phones

**Symptom A — "low fps, looks really bad":** a scene capped "to save the
phone". *Rule* (5+ sites). A `t - last <= 1000/30` throttle draws every 3rd
frame on 60 Hz (**20 fps**) and every 5th on a 120 Hz iPhone (**26 fps**). A cap
can also trip the scene's own fps → DPR fallback: one hero dropped every phone to
DPR 0.75 within 2 s ("too noisy").
**Fix:** no fixed phone frame caps. Draw at the display rate and pay with a
cheaper frame (DPR 1–1.5, fewer samples/particles, lighter bloom). Lifting caps
took scenes 26 → 120 fps with the phone scroll test unchanged or better.
**Prove it:** `node tools/qa/fps-probe.mjs --url …` — the scene's draws/s vs the
page's rAF/s at rest and touch-scrolling; draws ≈ rAF/3 or rAF/5 is a leftover
cap. Grep: `1000 / 30`, `1000/30`, `MOBILE_FRAME`, `frameBudget`, `frameloop`.

**Symptom B — "animates 2–4× too fast and shakes" before the first scroll.**
**Causes:** per-frame increments (`x += 0.02`, `lerp(a, b, 0.1)`) not scaled by
delta time run 2× at 120 Hz — 4× when two loops tick (StrictMode double mount, a
loop started on mount *and* resize, a worker loop + a page loop); a worker fed
the clock in **milliseconds** where the page path used **seconds** ran every
timed motion ~1000× fast, aliased into jitter (observed).
**Fix:** `src/lib/scene/per-frame.ts` — `createFrameClock()` (one clock in
seconds shared by every path, `dt` clamped), `+= k * dt * 60`,
`x += (target - x) * perFrame(k, dt)` or `damp(...)`; one loop per scene.
**Prove it:** speed is invisible to Lighthouse and the scroll test (they count
frames). Simulate 120 Hz by replacing `requestAnimationFrame` with an 8 ms timer
(`references/recipes.md`) and compare pixel change per 1/60 s at rest against
60 Hz; log the scene's time value on both paths for one second.

**Desktop is 120 Hz too** — cap a GPU-bound WebGL scene's *draw* at 60 fps there
(`optimize-3d-scene` §5). That is the one cap that is a rule.

## 4. Full-screen mobile menus

**Symptoms:** "make it a proper full-screen immersive menu"; "it appears
instantly"; "the bottom button is cut off by the iOS bar"; "the text has no
contrast, content not seen"; "the cross doesn't match the burger"; "focus is
lost a second after opening". *Rule* (10+ menus built).

**Causes and fixes:**
- **Height.** `inset-0` / `h-lvh` / `100vh` puts the menu's foot under Safari's
  bottom toolbar. Menus are static UI: `top-0 h-dvh`, bottom padding
  `max(<pad>, calc(env(safe-area-inset-bottom) + <pad>))`. (`viewport-fit=cover`
  only where no text sits in the landscape notch gutter.) Canvases are the
  opposite — `lvh` (§1).
- **It doesn't cover the screen.** A `fixed` overlay inside a transformed or
  separately layered header is fixed to *that* box. **Portal it under `<body>`.**
  A portal loses CSS variables set on wrappers (a scene colour) — render it
  inside the element that carries them, or copy them over.
- **Focus can't move in / is lost after ~1 s.** Show the panel in the same render
  that opens it, then focus; a portal returned straight from a react-spring
  `useTransition` render callback **remounts** (focus dropped ~1 s after
  opening) — create the portal inside the panel component instead.
- **Dark mode.** A menu on a theme token (`bg-background`) turns near-black on a
  dark-mode phone while a fixed-colour page stays light — one read ~1:1. Give the
  menu its own tokens; check with `prefers-color-scheme: dark` emulated. (Assume
  the reviewer's phone is in dark mode.)
- **Behaviour:** scroll locked while open (stop Lenis / the scroll API; restore
  after — `src/hooks/use-scroll-lock.ts`), Escape closes, a link closes then
  scrolls to its target, focus moves in and back to the toggle, Tab stays inside,
  `aria-expanded` + `aria-controls`, the page behind `inert`, the closed menu
  `inert`/unmounted (A11y must stay 100), reduced motion = a plain fade. Keep a
  scene behind it paused or running — never remount it.
- **Motion** (springs only): the panel enters by clip-path / scale / translate (a
  circle or wipe from the toggle, a curtain), links stagger in ~40–60 ms apart
  with transform + mask, the toggle morphs burger ↔ cross **in place** (same box,
  same lines), the exit is the reverse and faster. Reuse the site's eases,
  colours and display face; large links (~`clamp(2.5rem, 11vw, 4rem)`),
  secondary info (CTA, contact) at the foot. Burger lines sized against the
  wordmark's stroke and aligned to the header padding — "the closed burger looks
  off" was 1 px rules at 3× next to a 2 px stem.
- **Before redesigning, find which menu is mounted** — one site carried an unused
  full-screen menu next to the live dropdown.

**Prove it:** screenshots at 390×844 — closed, mid-open, open at rest, closing,
after a link — in light **and** dark scheme, in WebKit (`webkit-probe.mjs`);
check focus lands on the first link and returns to the toggle, `scrollY`
unchanged after a swipe while open, the foot clear of a 34 px safe-area inset.
Lighthouse A11y stays 100.

## 5. Touch: sliders, swipes, overflow, cursors

- **A horizontal slider won't swipe.** `touch-action: pan-y` blocks the finger
  when its drag handlers skip touch (leaving it to native scroll). Use
  `touch-action: manipulation` (or `pan-x pan-y`) and handle pointer events.
  *Observed.* `<model-viewer>` is the reverse: it swallows vertical scrolling
  unless `touch-action="pan-y"`. **Prove:** emulated touch — a sideways swipe
  moves the slider, a vertical one scrolls the page.
- **The whole page is zoomed out.** One section wider than the viewport (a
  `box-content w-full` with side padding) makes iOS fit the page. **Prove:**
  `document.documentElement.scrollWidth === innerWidth` at 320, 360, 390, 430
  after any phone layout change (`resize-check.mjs` reports overflow too).
- **Headlines break mid-word** ("DA/TA", "ADVANT/AGE") when a split-letter
  effect makes every letter an inline-block. Group letters in a
  `white-space: nowrap` word span; fit the phone headline size to its widest line
  (`calc((100vw - 2 × gutter) / <widest line in em>)`). **Prove:** screenshots at
  360/390/414/430, no overflow.
- **A custom cursor / "floating pointer" on a phone.** Mount cursor followers
  and hover pills only under `(hover: hover) and (pointer: fine)` — a tap's
  synthetic `mousemove` left one floating. Same gate for hover springs (also a
  TBT win).
- **Overlapping loader numbers / dense desktop ornaments on a phone** — hide or
  reflow them below `md` rather than shrinking them to illegibility.

## 6. Gyroscope hero motion (opt-in)

**When:** a static hero model on phones may "breathe" with the phone instead of
following a cursor that doesn't exist. It is a **taste call** — on production
sites it was kept on most and removed on some. Ask first.

**Fix:** `src/lib/scene/device-tilt.ts` — `startTilt()` on mount, `const t =
readTilt(dt)` per frame (`{x, y}` in [-1, 1], eased, relative to how the phone
was first held, slowly re-centred), `stopTilt()` on unmount. Apply small
amounts layered on the model's own motion (≈ ±8–15° yaw from `x`, ±5–8° pitch
from `y`, or a small parallax) — calm, never jittery. iOS 13+ sends nothing until
`DeviceOrientationEvent.requestPermission()` runs **inside a tap**; a scroll's
`touchend` is rejected, so the module re-arms for the next tap. Idle sway covers
"before permission", "declined" and "no sensor". Off for the robot form and
reduced motion; coarse pointers only. A worker scene: read on the page, post only
on change, rounded to 0.01.

**Prove it:** mobile emulation with touch, dispatch synthetic
`deviceorientation` events (`references/recipes.md`), screenshot two tilts; the
robot form and reduced motion don't move; **no permission prompt on load**;
Lighthouse A11y/BP/SEO unchanged. Unverifiable here: the real iOS permission
sheet and a real gyroscope's feel — say so.

## 7. The first scroll after a loader

**Symptom:** "during the loader the site scrolls a few sections down"; "on PC
the first scroll has so many freezes". *Observed.*

**Causes:** a preloader's `overflow: hidden` stops the browser, **not Lenis** —
Lenis scrolls the window itself (a wheel flick under one loader landed the page
1,643 px down; an effect restarting Lenis on mount undid the stop); scroll
restoration put a reload ~500 px down; and the scene build + section hydration
landed exactly on the first wheel after the lift — a moment the scroll test (which
starts ~1 s after unlock) never sees.

**Fix:** stop Lenis while the loader is up and through its reveal, and check no
effect restarts it; `history.scrollRestoration = "manual"` in the head script;
reset to the top as the loader leaves; build the scene and hydrate the sections
**under the loader** in short steps, one per idle callback; split the lift's
entrances into their own tasks.

**Prove it:** probe `scrollY` per frame with wheel/swipe input during the loader
(→ 0), reload after scrolling (→ 0), and a wheel from the exact unlock frame with
Long Animation Frames recorded — `node tools/qa/scroll-test.mjs --url …
--first-scroll` does this; `references/recipes.md` has the raw probe. No script
frame in the first seconds.

## 8. Stills shown full-screen on phones

**When:** a pinned scroll-story's phone version — the hero stays live, later
sections scroll in normal flow over stills of the scene (only with the client's
sign-off; it took two sites' phone scroll from janky to ideal). Or a poster.

**Symptom:** "the mobile stills must be high quality" — soft beads, a grey field.
**Cause:** captured from the *phone-tier* scene at low DPR, then recompressed by
`next/image` at q75. **Recipe** (observed, accepted in review): capture from
the **desktop-quality** scene in a phone-shaped viewport at the phone's real
density (3×, ~1182×2559), best of several frames, UI hidden;
AVIF q≈70 + WebP q≈88 at 2× and 3× in a `<picture>` with `sizes="100vw"`,
**served as captured** (`unoptimized`), and fetched on first input or ~3 s after
`load` so Lighthouse doesn't download them. `node tools/qa/capture-still.mjs
--url …` does the capture. Look at them at 100 % next to the live scene;
re-capture when the scene's look changes.

## 9. Phone layouts and padding

- **"Side padding 1rem" on a layout absolutely positioned from a 390-wide Figma
  frame** can't be done element by element (one site: ~30 files). Scale the root
  font so the edge lands at 16 px and centre the column; tell the client type grows
  up to ~14 % at 430 px. *Observed.*
- **Never decide the phone layout from JS width on the server** — a hook reading
  width 0 during SSR hydrates the desktop composition on phones, then rebuilds
  (observed: ~0.25 s of the longest task). CSS breakpoints; or render both and
  hide one.
- **Hero height on phones** is a design decision (reviewers asked for shorter
  heroes and darker overlays as often as for anything technical) — but whatever
  the box, a scene canvas inside it stays `lvh` and width-only-resized (§1).

## Close-out

Run, and report each as passed / failed-and-fixed / not verifiable here:

```sh
node tools/qa/ios-toolbar-probe.mjs  --url …   # §1 (any full-viewport scene)
node tools/qa/context-loss-probe.mjs --url …   # §2 (any long page with a live scene)
node tools/qa/fps-probe.mjs          --url …   # §3
node tools/qa/resize-check.mjs       --url …                # rotation, device presets, overflow
node tools/qa/webkit-probe.mjs       --url …   # iOS engine: menus, overflow, the bug at hand
node tools/qa/scroll-test.mjs        --url …   # no regression on the phone scroll
node tools/qa/lighthouse.mjs         --url …   # A11y/BP/SEO stay 100
```

Then `yarn lint`, `npx tsc --noEmit -p .`, `yarn build`,
`.claude/scripts/verify.sh`. **The final check is a real phone** — push a
preview and ask the client (or a teammate) to open it, naming exactly what to try (scroll down
and back, change scroll direction, open the menu, rotate). Write what you could
not verify. Log the change in `obsidian/meta/changelog.md`; a new iOS lesson →
`obsidian/knowledge/pitfalls.md` / `fix-catalog.md`; the workflow lives in
`obsidian/workflows/mobile-device-qa.md`.
