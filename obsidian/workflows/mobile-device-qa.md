---
tags: [workflow, mobile, ios, qa, stable]
updated: 2026-10-06
---

# Workflow — Mobile device QA (iOS and phone hardening)

The human-readable companion to the **`mobile-device-qa`** skill
(`.claude/skills/mobile-device-qa/`, command `/mobile`). It covers what breaks on
a real phone — mostly an iPhone — and what no lab instrument shows.
ADR: [[decisions-log]] ADR-0026. Fixes with evidence: [[fix-catalog]] §9.

> [!warning] Check on a real device before calling it done
> After 50+ sites had passed Lighthouse ≥ 90 and an ideal headless scroll test,
> a person reviewed them on an iPhone and found, on 26 of them: scenes
> flickering or vanishing on scroll, scenes at 20–26 fps, animations 2–4× too
> fast, menus cut off by Safari's toolbar or unreadable in dark mode, sliders
> that wouldn't swipe, a loader that dropped the page a few sections down.
> **None of it showed in any instrument.** Lighthouse never scrolls; the scroll
> test runs Chrome on a laptop GPU at 60/120 Hz; no tool here is Safari. Two fixes
> for one iOS bug passed every headless Chrome probe and failed on the phone.
> The probes below narrow the gap — they don't close it. Open the deploy on a
> phone, and if you can't, **say so in the report**.

## When to run it

- Any page with a WebGL/canvas scene, a full-screen menu or overlay, a loader, a
  horizontal slider, or scroll-driven motion.
- Before [[ship]], and after any change to those.
- Whenever someone reports "it looks wrong on my phone" — reproduce first.

## 1. Safari's toolbar (the URL bar resize)

**What happens:** scrolling collapses/expands Safari's toolbar, changing the
viewport height and firing `resize` — on every scroll-direction change.

- **Scenes / canvases:** size the box to the **large** viewport (`lvh`, or a px
  height read once) and, on touch, re-measure only when the **width** changes.
  Skip resizes whose size and DPR didn't change; on a real one, draw immediately
  (a reallocated buffer is blank until the next draw). A worker scene guards its
  own resize handler too. r3f: never a static `frameloop` prop alongside a later
  `setFrameloop` — it's re-applied on re-render and stops the loop. Use
  `src/utils/stable-viewport.ts` and `src/components/common/scene-viewport.tsx`.
- **Menus and overlays** are the opposite: `top-0 h-dvh` + bottom padding
  `max(pad, env(safe-area-inset-bottom) + pad)`. `inset-0` / `h-lvh` puts the
  menu's last button under the bottom bar.
- **Scroll triggers** that measure `innerHeight` (and `ScrollTrigger.refresh`,
  Lenis resize) on every resize jump with the toolbar — measure once, update on
  width.
- **Never stop drawing a visible canvas** to save power — iOS may drop the last
  frame on a re-composite and the hero "disappears". Pause only off-screen.
- **Probe:** `yarn qa:ios --url …` — steps the height 844 → 760 → 844 → 700 at a
  fixed width while scrolled; FAILS on a buffer/box change, a blank frame, a
  stopped loop; then a rotation must still resize. With several canvases, point
  it at the right one (`--sel`).

## 2. Frame rate — 120 Hz, no phone caps, delta time

- **No fixed frame cap on phones.** A `1000/30` budget throttle draws 20 fps on a
  60 Hz phone and 26 fps on a 120 Hz iPhone — "very low fps" to anyone holding
  it. Lifting caps on 7 sites gave 55–120 fps with the phone scroll test the
  same or better. Pay with a cheaper frame (DPR, samples, particles). If a cap
  is unavoidable, skip alternate frames (`frame % 2`).
- A scene with an **fps-driven DPR fallback** must not sit under a cap — the cap
  reads as a weak device and the scene drops to DPR 0.75 ("noisy").
- **Every per-frame increment scaled by dt** (`+= k * dt * 60`, easing
  `1 - exp(-rate * dt)`), one time source in **seconds** for page and worker —
  `src/lib/scene/per-frame.ts`. Look for duplicate loops (StrictMode, a loop
  started on both mount and resize).
- (Desktop is different: a GPU-bound scene draws at most 60 fps there —
  [[fix-catalog]] §5.)
- **Probes:** `yarn qa:fps --url …` — counts real draws vs rAF, at rest and while
  touch-scrolling, phone viewport, 4× CPU (blind to a worker's own draws — check
  the worker's loop by reading it). 120 Hz speed: replace `requestAnimationFrame`
  with an 8 ms timer in a headless run and compare motion per second against
  60 Hz.

## 3. WebGL context loss

iOS drops WebGL contexts under memory pressure (large stills decoding, other
tabs). Nothing rebuilds them by default: scroll to the bottom and back → the hero
is gone.

- `webglcontextlost` → `preventDefault()`; when the scene nears the viewport, the
  tab returns or `pageshow` fires, check `gl.isContextLost()` and rebuild on a
  fresh context at rest (≥ 1 s apart, 3 retries). Release the context on every
  teardown; don't allocate desktop-only targets on phones.
  `src/lib/scene/webgl-context.ts`.
- **Probe:** `yarn qa:context --url …` — scrolls to the bottom and back, forces
  `WEBGL_lose_context` off- and on-screen, checks the hero draws again.

## 4. Menus and overlays

- Full-screen, above everything (scene canvas, banner), `top-0 h-dvh`, safe-area
  bottom padding, **its own colour token** — emulate dark mode
  (`prefers-color-scheme: dark`): the client's phone is in dark mode, and a
  theme-following background went black under fixed-colour text.
- Portal it under `<body>` (a transformed header traps `fixed`), carrying any CSS
  variables it reads; create the portal inside the panel, not from a transition
  callback (it remounts and loses focus). Show it in the same render that opens
  it, or focus can't move in.
- Behaviour: scroll locked while open (stop Lenis, restore after), Escape closes,
  a link click closes then scrolls, focus in and back to the toggle,
  `aria-expanded` / `aria-controls`, `inert` when closed, reduced motion = a fade,
  the scene behind paused or kept — never remounted.
- The burger and close icons align with the header's grid and match each other's
  stroke and position; look at closed / mid-animation / open / closed again.
- Find which menu component is actually mounted before redesigning one.

## 5. Touch

- A horizontal slider whose drag handlers skip touch: `touch-action: pan-x pan-y`
  (or `manipulation`), never `pan-y`. Test with emulated touch: a sideways swipe
  moves it, a vertical one scrolls the page.
- `<model-viewer camera-controls>`: `touch-action="pan-y"` (it defaults to
  `none` and swallows the page scroll).
- No hover springs, pointer-driven CSS writes or custom cursors on coarse
  pointers; a custom cursor never hides the native one.
- Fixed bottom overlays (the cookie banner) eat swipes that start on them.

## 6. Gyroscope (optional, a design choice)

A static hero model can follow the phone's tilt — `src/lib/scene/device-tilt.ts`:
coarse pointers only, listeners after mount, iOS asks permission only **inside a
tap** (a scroll's `touchend` is rejected — re-arm on the next tap), a calm idle
sway before/without permission, off for the robot form and reduced motion, small
angles (±8–15° yaw, ±5–8° pitch). Verify headless by dispatching synthetic
`deviceorientation` events; you **cannot** test the real permission sheet without
a device — say so. On 2 of 7 sites the client removed it after seeing it: show
it, don't assume it.

## 7. Loader and the first scroll

- A loader must really lock the scroll: Lenis ignores `overflow: hidden` — stop
  Lenis, `history.scrollRestoration = "manual"`, scroll to top when it leaves (a
  flick under one site's loader landed the page 1,643 px down).
- People scroll **the instant** the loader lets go. Build scenes and hydrate
  sections **under** the loader, not on the first wheel; probe a wheel from the
  unlock frame (the scroll test starts ~1 s later and missed it).
- Loader numbers and labels can overlap on narrow phones — look at 360 px.

## 8. Phone layout

- `document.documentElement.scrollWidth === innerWidth` at 360, 390, 414, 430 px
  (overflow zooms the whole page out).
- Per-letter headlines: letters grouped in `white-space: nowrap` word spans.
- Side padding consistent (1rem) — layouts built in flow, not absolute from a
  390 px Figma frame.
- Resize live (`yarn qa:resize`): window jump and drag, DevTools device mode on
  and off, rotation — each must land where a fresh load does.

## 9. Stills in place of a scene (phones)

When a scene section is replaced by stills on phones (client-approved only):
capture from the desktop-quality scene at phone shape and DPR 3 (~1170+ px wide),
best frame, AVIF/WebP at 2×/3×, served unoptimised, loaded on first input or 3 s
after load; look at them at 100 % next to the live scene.
`node tools/qa/capture-still.mjs --url …`.

## 10. WebKit, then the device

For anything iOS-only, a Chrome probe passing proves little. In order:

1. `yarn qa:webkit --url …` — the probes in WebKit with an iPhone profile and
   touch momentum. Reproduce the bug **before** fixing; a fix verified only in
   Chrome is a guess.
2. A self-check in the code where the stakes are high (a hero that is on screen
   but not drawing recovers itself).
3. **The device.** Walk the list below on an iPhone (Safari), ideally also an
   Android Chrome.

### Device walk (5 minutes)

- Load cold; watch the loader → first screen; scroll **immediately**.
- Scroll the whole page down and back up, changing direction often (toolbar).
- Does the scene stay drawn, at the same speed, smooth? Does it come back after
  reaching the bottom?
- Open/close the menu — bottom button visible, readable, focus sane; try dark
  mode.
- Swipe every slider sideways; scroll over every interactive canvas.
- Rotate; switch tabs and come back.
- Turn on Reduce Motion — the page stays usable and nothing loops.

## Related

[[testing-pipeline]] · [[fix-catalog]] · [[pitfalls]] · [[optimize-3d-scene]] ·
[[optimize-performance]] · [[qa-verification]] · [[ship]]
