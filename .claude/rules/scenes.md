---
paths:
  - "src/**/*scene*"
  - "src/**/*Scene*"
  - "src/**/*canvas*"
  - "src/**/*webgl*"
  - "src/**/*three*"
  - "src/**/*.worker.ts"
  - "src/lib/scene/**"
  - "src/components/common/scene-viewport.tsx"
  - "src/utils/stable-viewport.ts"
description: WebGL / canvas scenes on phones — viewport, frame rate, time, context loss
---

# Scenes (three.js, raw WebGL, canvas)

Full note: `obsidian/frontend/webgl-scenes.md` · Skill: `optimize-3d-scene`

Each line below was a defect on real iPhones that no lab instrument saw.

1. **Box at the large viewport.** A full-screen scene sits in `<SceneViewport>`
   (`@/components/common/scene-viewport`) — `100lvh`, re-measured on touch
   devices only on a **width** change. Never `h-dvh` / `fixed inset-0` /
   `innerHeight` around a canvas: iOS's toolbar resizes them mid-scroll and the
   renderer reallocates (blank frame = "flicker"; physics re-seeded; an r3f
   `<Canvas frameloop>` prop re-applied → black for good).
2. **Resize only on a real change.** Skip a resize whose CSS size and DPR are
   unchanged; after a real one, draw immediately. Same guard inside a worker.
3. **Never stop drawing a visible canvas.** Pause only when off screen (in-view
   loop). iOS drops the last frame after a toolbar resize; a stopped scene
   never repaints.
4. **Context loss is recoverable.** `keepSceneAlive` + `watchContext` +
   `releaseContext` from `@/lib/scene/webgl-context`: `preventDefault` the loss,
   rebuild on a fresh context near the viewport / on tab return, release the
   context on every teardown.
5. **Time in seconds, one clock.** `createFrameClock()` from
   `@/lib/scene/per-frame` for every path that draws (page and worker). Per-frame
   easing via `perFrame(k, dt)`.
6. **No fixed phone frame cap**; no fps-driven DPR fallback under a cap (it
   reads its own cap as a weak device). Desktop on 120 Hz panels may draw at
   most every ~12.5 ms when GPU-bound — gate the draw, keep easing per tick.
7. **Robot form and reduced motion:** the robot form shows a still (no WebGL
   download — `next/dynamic` / `import()` behind `!robot`); device tilt
   (`@/lib/scene/device-tilt`) is off for both. iOS motion permission is asked
   only inside a tap, never on load.
