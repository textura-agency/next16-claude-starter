---
tags: [frontend, webgl, mobile, stable]
updated: 2026-10-06
---

# WebGL scenes on real phones

The starter ships no scene — it ships the utilities every scene on a phone
turned out to need, each one a defect a reviewer saw on an iPhone that no lab
instrument (Lighthouse, a scroll test, desktop Chrome) had caught. Rules bind
in `.claude/rules/scenes.md`; the performance playbook (tiering, prewarm, DPR,
workers) is the `optimize-3d-scene` skill.

| Module | For |
|--------|-----|
| `src/utils/stable-viewport.ts` | a viewport height that ignores the iOS toolbar |
| `src/components/common/scene-viewport.tsx` | `<SceneViewport>` — the fixed full-bleed box for a canvas |
| `src/lib/scene/per-frame.ts` | `createFrameClock()`, `perFrame(k, dt)`, `damp()` — time in seconds |
| `src/lib/scene/webgl-context.ts` | `keepSceneAlive()`, `watchContext()`, `releaseContext()` — context-loss recovery |
| `src/lib/scene/device-tilt.ts` | `startTilt()` / `readTilt(dt)` / `stopTilt()` — the gyroscope as a cursor |

## The iOS toolbar

Safari collapses and expands its URL bar as the page scrolls: the viewport's
height changes and `resize` fires. A scene box sized `100dvh` / `fixed inset-0`
/ `innerHeight` follows it; the renderer's `setSize` reallocates the drawing
buffer (cleared → a blank frame) and redraws — "the scene flickers on scroll".
Seen on 4 production sites (*rule*): one also re-randomised its physics on
every resize (balls jumped), and an r3f `<Canvas frameloop="never">` re-applied
its static prop on re-render — after the second resize the scene stayed black.

```tsx
<SceneViewport className="-z-10">
  <canvas ref={canvasRef} className="size-full" />
</SceneViewport>
```

- The box is `100lvh` from the first paint, then a px height that a touch
  device re-measures **only when the width changes** (rotation, settled 300 ms
  later). Desktop windows follow every resize.
- The renderer: skip a resize whose CSS size and DPR didn't change; on a real
  one, draw in the same frame. In a worker (OffscreenCanvas) the same guard
  goes in the worker's own resize handler.
- r3f: own the size (a wrapper with a fixed px height) and never combine a
  static `frameloop` prop with a later `setFrameloop`.
- Also check `visualViewport` listeners, `ResizeObserver`s on scene wrappers,
  and scroll-trigger refreshes that run on every resize.
- Verify: mobile emulation, change only the viewport height while scrolled —
  canvas `width`/`height` attributes must not change, no blank frame. The
  testing pipeline has `qa:ios` (toolbar probe) — see [[testing-pipeline]].

## Frame rate and time

- **No fixed phone frame cap.** A `t - last < 1000 / 30` budget throttle on a
  60 Hz display draws every third frame (**20 fps**) and every fifth on 120 Hz
  (**~26 fps**) — on a real phone it reads as "low FPS, looks really bad". Lifting it:
  26 → 120 fps at rest, phone scroll test *better* (1.19 → 0.58 % dropped).
  *Rule* (5+ sites). Pay for smoothness with a cheaper frame — DPR 1–1.5,
  fewer samples / particles — and measure the real rate (`qa:fps`). If a cap is
  truly needed, skip alternate frames (`frame % 2`), never a budget throttle.
- **A cap can trip the scene's own fallback.** An fps-driven adaptive-DPR
  monitor under a 30 fps cap read ~26 fps as a weak device and dropped every
  phone to DPR 0.75 — a "noisy" hero. *Observed* (1).
- **Desktop: gate the draw at ~60 fps.** Desktop scenes redrawing at 120 Hz
  were the steady scroll-drop cause on several sites; `createDrawGate(isDesktop)`
  from `src/lib/scene/per-frame.ts` (`if (gate.shouldDraw(dt)) render()`) gates
  the draw only — easing still steps every tick. *Rule* (6 sites). Never on
  phones (above).
- **Scale every per-frame step by dt** — phones run at 120 Hz, a busy one at
  30, a scene in a worker may tick twice:

  ```ts
  const clock = createFrameClock();
  const frame = (now: number) => {
    const { dt, t } = clock.tick(now);           // seconds
    pos += (target - pos) * perFrame(0.08, dt);  // authored at 60 fps, same feel at any rate
    uniforms.uTime.value = t;
  };
  ```

  Simulate 120 Hz headless by replacing `requestAnimationFrame` with an 8 ms
  timer and compare speed against 60 Hz. Check for duplicate loops (StrictMode
  double mounts, a loop started on both mount and resize).
- **Worker clock in seconds.** A scene moved into an OffscreenCanvas worker
  received its time in milliseconds where the page path passed seconds: every
  timed motion ran ~1000× fast, aliased into jitter ("2–4× too fast and
  shaking"). One clock, one unit, for both paths — measured 4.9 → 0.81
  px/frame vs the page path's 0.78. *Observed* (1) — but no lab metric sees
  speed, so check it on every worker scene.
- **Desktop on 120 Hz panels** (GPU-bound, steady drops with the main thread
  idle): draw at most every ~12.5 ms (between a 120 Hz and a 60 Hz tick) — gate
  only the draw, keep easing stepping every tick. *Rule* (3+).
- The shared ticker (`src/lib/animation/ticker.ts`) throttles each subscriber
  by a **minimum gap** — that is a budget throttle. Don't drive a visible scene
  through it with a phone-sized `framerate`; use its default per-frame rate or
  your own rAF.

## Never stop drawing a visible canvas

Pause only when the canvas is **off screen** (an in-view loop). A scene that
froze its hero after 10 % of scroll relied on the browser keeping the last
frame; iOS drops it after a toolbar resize, and a stopped scene never repaints
— the hero "disappears". *Observed* (1), fixed with the stable viewport.

## A lost context

iOS drops WebGL contexts under memory pressure (decoding big stills while the
hero is off screen is enough); nothing rebuilt it, so scrolling the page and
back left a blank hero. `keepSceneAlive` encodes the measured recovery:

```ts
useEffect(() => {
  const container = boxRef.current!;
  return keepSceneAlive({
    container,
    build: async ({ settled, onContextChange }) => {
      const scene = await createHeroScene(container, { skipIntro: settled });
      const unwatch = watchContext(scene.canvas, onContextChange);
      return {
        isBroken: () => scene.gl.isContextLost(),
        frames: () => scene.frameCount,          // enables the on-screen self-check
        dispose: () => {
          unwatch();
          scene.dispose();
          releaseContext(scene.gl);              // three.js: renderer.forceContextLoss()
          scene.canvas.remove();
        },
      };
    },
    onFail: () => setShowStill(true),
  });
}, []);
```

- `webglcontextlost` is `preventDefault`ed; a restored context is rebuilt, not
  trusted (rendered resources — PMREM environments, render targets — come back
  empty).
- Rebuilds happen when the scene nears the viewport (`50%` margin), the tab
  returns, or the page comes back from the bfcache; ≥ 1 s apart; 3 failed
  builds and it stops (show the still).
- While on screen, once a second, a scene that reports `frames()` is asked
  whether it still draws — WebKit sometimes never sends the event.
- Don't reserve desktop-only render targets on phones.
- Reproduce: `gl.getExtension("WEBGL_lose_context").loseContext()` (the
  testing pipeline's `qa:context`). *Observed* (1) — every long page with a
  live hero has the gap.

## Device tilt

`device-tilt.ts` turns the gyroscope into a cursor for a hero model on phones:
`startTilt()` on mount, `readTilt(dt)` per frame → `{ x, y }` in [-1, 1],
eased, re-centred slowly to how the phone is held; `stopTilt()` on unmount.

- Coarse pointers only; off (always 0) under reduced motion and on the robot form.
- iOS 13+ sends nothing until `DeviceOrientationEvent.requestPermission()` is
  called **inside a user gesture**: the module asks on the first tap; an ask
  rejected for want of activation (the `touchend` that ended a scroll) re-arms
  for the next tap. Never a prompt on load (Best Practices).
- Before permission, without it, or with no sensor: a slow idle sway, so the
  model is never dead.
- Apply small: ≈ ±8–15° yaw from `x`, ±5–8° pitch from `y`, layered on the
  model's own motion. A worker scene: read on the page, post only on change.
- Verify headless with synthetic
  `window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta, gamma }))`
  under mobile emulation; the real iOS permission sheet needs a device.

## Related

[[animation-system]] · [[robot-form]] · [[mobile-menus]] · [[utils]]
