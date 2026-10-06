---
tags: [workflow, skill, performance, 3d, stable]
updated: 2026-10-06
---

# Workflow — Optimise a 3D Scene (skill)

Registers the **`optimize-3d-scene`** Claude Code skill
(`.claude/skills/optimize-3d-scene/`) as part of this project's workflow set, and
maps its canonical patterns onto the primitives this starter already ships.

> [!important] Routing rule
> **When a performance request lands on a project that carries a three.js /
> WebGL scene, invoke the `optimize-3d-scene` skill before doing anything else.**
> It is the source of truth for that work — do not improvise a different order
> of fixes. This is codified as AGENTS.md hard rule #11.

## When it triggers

Invoke the skill when **both** are true:

1. The request is about performance, jank, or shipping readiness — *"optimise the
   3D"*, *"the scene lags on mobile"*, *"micro freezes / jank on scroll"*,
   *"make the scene mobile-friendly"*, *"reduce the WebGL cost"*, *"why is
   Lighthouse red"*, or a pre-ship pass on a project that carries a scene.
2. The project actually renders WebGL — `three` (or `@react-three/fiber`) is in
   `package.json`, **or** there is a `<canvas>` driven by a hand-written
   `getContext("webgl")` render loop. Raw WebGL is fully in scope; only §0's
   measurement primitives change.

If the project has **no** scene, this note does not apply — performance work then
belongs to [[animation-system]] (spring/ticker cost) and [[seo-metadata]] (bot
path, metadata, bundle).

> [!note] The starter itself ships no 3D
> `next16-claude-starter` has **no `three` dependency** — see [[tech-stack]]. This
> workflow exists for projects *built from* the starter that add one. Adding
> `three` is a dependency change: update [[tech-stack]] and [[changelog]] in the
> same turn.

## What the skill does

Fourteen steps, applied **in order** — cheapest and highest-impact first. Full
text in `.claude/skills/optimize-3d-scene/SKILL.md`; reference code in
`references/patterns.md`.

| § | Step | The point |
|---|------|-----------|
| 0 | Audit first, on a valid footing | Baseline `renderer.info.render` / `.programs` / `.memory` — or, on a **raw WebGL** scene, the `getContext` hook you install first. Plus the environment rules: production build, fresh server, `waitUntil: "load"`, counted quantities only. |
| 1 | Never ship the scene to a bot | The robot form (proxy rewrite, [[seo-aeo]]) gets a still of the scene, and the `three` chunk is never fetched or evaluated. The still is for screenshots and the no-WebGL fallback — *not* layout stability. |
| 2 | Tier the device at construction, re-read on a real change | One module owns what "mobile" means; DPR, counts, bloom and frame budget all read from it. Held in a mutable slot; a width change or a pointer-media-query flip re-reads it and `retune()` re-applies every tier-derived value without compiling a program ([[decisions-log]] ADR-0023). |
| 3 | Prewarm **everything** in the loader | Compile, link, upload, allocate *and decode* before handoff — the rule that kills micro-freezes. Compile **against the composer's real render targets**, with objects **visible**, every post pass run once, one step per `requestAnimationFrame` (not `setTimeout(0)`), one program / upload per task (rule, 6 sites). Also where §1's code-split fights §3, and where the preload-credentials trap bites. |
| 4 | Render only when visible | Gate on `document.hidden` + in-view + canvas actually visible. Biggest saving on a scroll site. |
| 5 | Frame rate per tier | **No fixed cap on phones** — a `1000/30` budget drew 20 fps at 60 Hz and 26 fps at 120 Hz and read as "very low fps" on an iPhone; lifting it (7 sites) gave 55–120 fps with the phone scroll the same or better. Pay with a cheaper frame. **Desktop:** a GPU-bound scene draws at most every ~12.5 ms (60 fps on 120 Hz panels; rule, 5 sites). Per-frame motion scaled by dt. *Amends the earlier 30/45 fps budgets — ADR-0026.* |
| 6 | Clamp pixel ratio — **and the composer** | A 3× phone renders 9× the fragments. Clamping the renderer but not `EffectComposer` throws the saving away. |
| 7 | Cut fill, not detail | Particle counts, bloom, additive overdraw, renderer flags, shadows. On a *baked* point buffer, check ordering before truncating. |
| 8 | Fewest lights the look survives | One key + IBL; a light-count change recompiles every program. |
| 9 | Transforms on the GPU | Scroll drives a uniform, never a per-object JS loop. |
| 10 | Smooth scroll progress on touch | Low-pass once upstream (`k ≈ 0.22–0.3`), snap on page jumps. |
| 11 | No cursor interactivity on mobile | Don't attach the listener; gate on "pointer has actually moved". |
| 12 | Compress assets | Draco geometry (local decoder), KTX2/Basis textures, per-tier size caps. |
| 13 | The iOS flicker details | Resize listener on **every** tier, ignoring height-only changes on a coarse pointer (the URL bar) — *not* "no resize on touch"; skip same-size resizes, draw at once on a real one (worker side too). **Canvas `lvh` / content and menus `dvh`**, promoted compositor layer, clamped `dt`, dispose on unmount. **Never stop drawing a visible canvas** (iOS drops the last frame); **recover a lost WebGL context**. Verify with `qa:ios` and `qa:context` — [[mobile-device-qa]]. |
| 14 | Verify, then write it down | Re-measure §0 on the same footing; program count must be **stable after the loader**. |

> [!warning] The three traps that cost the most time in the field
> 1. **§0 assumes three.js.** A raw WebGL scene has no `renderer.info` — you must
>    build the instrumentation before you can measure anything, and the skill now
>    ships the `getContext` hook that does it.
> 2. **Dev-mode numbers are invalid.** Eager chunk serving fakes a §1 failure;
>    Strict Mode's double-mount fakes doubled listeners and a halved frame rate.
>    Always `build` + `start`, and kill the old server first.
> 3. **§1 breaks §3 by construction.** `dynamic(ssr: false)` means the scene
>    can't compile until after hydration — measured at 5.0 s against a loader
>    that lifted at 2.36 s. Gate the loader on scene-ready, not on a duration.
> 4. **"No resize on touch" was a bug, not a rule.** The first cut of §13 removed
>    the resize listener entirely on the mobile tier. That also removed the only
>    path that could notice a breakpoint drag, a rotation or DevTools emulation
>    being switched off — the scene kept the phone buffer on a desktop viewport
>    and drew skewed. Fixed 2026-09-08 (ADR-0023): listen everywhere, skip
>    height-only changes on a coarse pointer, retune on a tier change.

## What production taught (read before §3–§7)

Measured on the scene-carrying sites among 50+ built from this starter — details
and evidence in [[fix-catalog]] §2, §5 and §9:

- **Geometry math off the main thread** (a module Worker; rule, 5 sites — mobile
  TBT 4,269 → 207 ms once), and **the whole scene in an OffscreenCanvas worker**
  on phones/tablets, started **after `load`**, clock in seconds like the page
  path, state posted only on change (rule, 4 sites). Not on desktop — it cost the
  desktop scroll.
- **DPR per tier, renderer and composer** (desktop ≤ 1.5); cut passes not looks
  (transmission at half resolution, shadow maps updated every other frame, empty
  composers deleted).
- **Models compressed** (WebP textures, Draco geometry, per-tier sizes:
  `gltf-transform resize → webp → draco`); downloads started at first paint, not
  in `<head>`; three.js `import()`ed after first paint, never re-exported from a
  barrel, drei only inside the lazy scene.
- **A below-the-fold scene mounts on idle after load**, not on proximity (its
  setup otherwise lands in the scroll); never defer *preloads* to the first scroll.
- **The phone is the judge**: no instrument here sees a phone's GPU, Safari's
  toolbar or a 120 Hz display. `qa:fps`, `qa:ios`, `qa:context`, `qa:webkit`, then
  a real device — [[mobile-device-qa]].

## Mapping onto this starter

The starter ships no `three`, but it ships the dependency-free scene helpers the
fixes above need. Use the local one rather than writing a second copy:

| Skill pattern | Use in this project |
|---|---|
| one shared rAF for the whole page (§4) | `subscribeToTicker` — `src/lib/animation/ticker.ts`, per-subscriber throttling built in ([[decisions-log]] ADR-0009). Also serves §5's frame budget. |
| bot detection (§1) | The robot form — `src/proxy.ts` rewrites bot UAs (`src/utils/bot-ua.ts`) to a static `/robot-view`; `useMotionOff()` (`src/hooks/use-motion-off.ts`) tells a component it is on the robot form or under reduced motion. Never `await isBot()` in a page — it makes `/` dynamic ([[seo-aeo]]). |
| scroll progress source (§9, §10) | The Lenis scroll store — [[smooth-scroll]]. Read it once per frame inside the ticker; never in a scroll handler that also writes styles. |
| in-view gating (§4) | `useDynamicInView` / `useInViewRef` — [[hooks]]. Give the observer a ~1 viewport `rootMargin` so the scene is warm on arrival. |
| viewport sizing (§13) | `src/utils/stable-viewport.ts` + `src/components/common/scene-viewport.tsx` — the scene box at the large viewport, re-measured on touch only on a width change (also `heightLvh` in `src/utils/lvh.ts`). Lay **content and menus** out in `dvh`, or their bottom hides behind the URL bar. Canvas `lvh`, content `dvh`. |
| per-frame time (§5, §13) | `src/lib/scene/per-frame.ts` — dt helpers: `+= k * dt * 60`, exponential easing by dt, one clock in seconds. |
| context loss (§13) | `src/lib/scene/webgl-context.ts` — `webglcontextlost` handling and rebuild-on-return. |
| gyroscope (optional) | `src/lib/scene/device-tilt.ts` — phones only, permission on a tap, off for robots and reduced motion. A design choice — show it to the client. |
| device tiering (§2) | **Not in the starter.** Add `src/lib/scene/device.ts` when a project needs it, and document it in [[utils]]. |

## How it sits with the hard rules

- **Rule 1 (all motion is spring-based)** is about DOM/React motion. A WebGL
  render loop is not DOM motion and is not governed by it — but everything
  *around* the canvas (reveals, overlays, loader UI, section transitions) still
  is: springs from [[animation-system]], text from [[text-engine]], no CSS
  keyframes.
- **Rule 2 (`#do-not-modify` engine)** stands. The scene subscribes to the
  ticker; it never edits `src/hooks/animation/` or the spring components.
- **Rule 4 (no hardcoded values)** applies to tier constants too — DPR clamps,
  particle counts and frame budgets belong in the scene's device module as named
  constants, not sprinkled through the render code.
- **Rule 6 (Server Components by default)** — the scene is a `"use client"` leaf
  loaded with `dynamic(..., { ssr: false })`, which is also what keeps `three` in
  its own chunk for §1.

## After running it

Per §14 and the [[ai-agent-guide]] rules, in the same turn:

- Behaviour or measurable performance change → [[changelog]], with the
  before/after numbers.
- A trade-off chosen (a look sacrificed for a tier, a pass dropped) → an ADR in
  [[decisions-log]] **with the reasoning**.
- A new module (`device.ts`, a scene util, a hook) → [[utils]] or [[hooks]].
- `three` and any loaders/compressors added → [[tech-stack]].

## Related

- [[ai-agent-guide]] — rules of engagement; lists the skill routing rule
- [[animation-system]] — the ticker and spring primitives the scene shares
- [[smooth-scroll]] — the scroll source a scroll-driven scene reads
- [[seo-metadata]] — the bot path §1 hangs off
- [[fix-catalog]] · [[pitfalls]] · [[testing-pipeline]] · [[mobile-device-qa]]
- [[decisions-log]] ADR-0009 (shared ticker), ADR-0010 (SEO/perf hardening),
  ADR-0016 (this registration), ADR-0023 (resize on every tier), ADR-0026 (lessons
  from production sites; phone caps removed)
