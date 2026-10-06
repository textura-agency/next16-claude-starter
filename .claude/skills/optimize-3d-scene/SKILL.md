---
name: optimize-3d-scene
description: Optimise a three.js **or raw WebGL** scene for phones, 120 Hz panels and low-end devices — device tiering, prewarm-everything-under-the-loader so nothing compiles mid-scroll, in-view-only render loops, DPR and particle/bloom budgets (never a fixed phone frame cap), the 60 fps desktop cap, OffscreenCanvas worker scenes, GPU-side scroll transforms, compressed models, iOS toolbar/context-loss survival, and keeping the scene off the robot form. Use when the user says "optimise the 3D", "the scene lags on mobile", "low fps", "micro freezes / jank on scroll", "make the scene mobile-friendly", "reduce the WebGL cost", or before shipping any page that carries a WebGL scene.
---

# Optimise a 3D scene

Every page that carries a three.js scene pays the same tax: a phone renders the
same fragments as a workstation, the first frame after a shader appears
compiles mid-scroll, and the render loop keeps running behind three sections of
copy nobody is looking at. This skill fixes those in a fixed order — cheapest
and highest-impact first. It was rewritten from optimisation passes on ~50
production sites; each rule says whether it is a **rule** (held on ≥ 3 sites)
or **observed** (1–2 — try it, measure it, don't assume it).

Every step applies to a **raw WebGL** scene as much as a three.js one; only §0's
measurement primitives differ (three.js hands you `renderer.info`, a raw scene
you instrument yourself — which you must do *before* you can begin).

Before you fix anything, read `obsidian/knowledge/fix-catalog.md` and
`obsidian/knowledge/pitfalls.md` — the answer, and the trap next to it, may
already be written down. iOS / real-phone behaviour (toolbar resizes, context
loss, 120 Hz speed, gyroscope) is owned by `mobile-device-qa`; this skill links
to it where they meet.

**Modules this starter already ships — use them, don't write a sixth copy:**

| need | module |
|---|---|
| one clock in seconds, dt-scaled easing (`createFrameClock`, `perFrame`, `damp`) | `src/lib/scene/per-frame.ts` |
| a scene box that ignores the iOS URL bar | `src/utils/stable-viewport.ts` + `src/components/common/scene-viewport.tsx` |
| WebGL context-loss recovery (`keepSceneAlive`, `watchContext`, `releaseContext`) | `src/lib/scene/webgl-context.ts` |
| gyroscope tilt for a hero model on phones | `src/lib/scene/device-tilt.ts` |
| robot / reduced-motion switch | `src/hooks/use-motion-off.ts`, `src/utils/bot-ua.ts`, `src/proxy.ts` |
| device tier, ticker, visibility gate, 60 fps desktop draw gate, scroll lerp, disposal | `references/patterns.md` (copy-paste forms) |

Architecture notes for these: `obsidian/frontend/webgl-scenes.md`,
`obsidian/frontend/robot-form.md`.

## 0. Audit before you touch anything

Never optimise blind. Establish the baseline:

```sh
# what's actually in the scene
grep -rn "setPixelRatio\|requestAnimationFrame\|new THREE\..*Light\|UnrealBloom\|Points\|InstancedMesh\|transferControlToOffscreen\|1000 / 30\|frameloop" src/ --include=*.ts --include=*.tsx --include=*.js
```

Then in the running page's console:

```js
renderer.info.render      // { calls, triangles, points } — per frame
renderer.info.programs.length   // shader programs; each one is a compile stall if it appears late
renderer.info.memory      // { geometries, textures }
```

**Raw WebGL (no three.js).** `renderer.info` only exists on
`THREE.WebGLRenderer`. A hand-written scene has no equivalent — hook the context
before app code runs and count it yourself, or you cannot start:

```js
// page.evaluateOnNewDocument — counts passes, vertices, and *when* programs link
const gc = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, attrs) {
  const ctx = gc.call(this, kind, attrs);
  if (ctx && kind === "webgl") {
    window.__gl = ctx;
    window.__p = { draws: 0, verts: 0, frames: 0, links: [], attrs };
    const draw = ctx.drawArrays.bind(ctx);
    ctx.drawArrays = (m, f, c) => { window.__p.draws++; window.__p.verts += c; return draw(m, f, c); };
    const clear = ctx.clear.bind(ctx);          // one clear = one frame
    ctx.clear = (m) => { window.__p.frames++; return clear(m); };
    const link = ctx.linkProgram.bind(ctx);     // §3/§14: these must all precede the loader handoff
    ctx.linkProgram = (p) => { window.__p.links.push(Math.round(performance.now())); return link(p); };
  }
  return ctx;
};
```

`draws`/`verts` replace `info.render`, `links.length` replaces
`programs.length` (and `links` timestamps are what §3 is actually measured
against), `gl.drawingBufferWidth/Height` is the §6 check, and the captured
`attrs` is the §7 renderer-flags check. Full harness in `references/patterns.md`.

**The standing instruments** (`tools/qa/`, see its README; `yarn qa:setup`
once — they install into a cache outside the project). All take `--url` of a
running `yarn build && yarn start`:

| question | tool |
|---|---|
| how many frames does the *scene* draw (vs the page's rAF)? | `node tools/qa/fps-probe.mjs --url …` |
| does the scroll drop frames, where, and why? | `node tools/qa/scroll-test.mjs --url …` |
| which code is the long task (source-mapped)? | `node tools/qa/profile.mjs --url … [--scroll-to "<sel>"]` |
| does an iOS toolbar height step clear / re-size the canvas? | `node tools/qa/ios-toolbar-probe.mjs --url …` |
| does the hero draw again after a context loss off screen? | `node tools/qa/context-loss-probe.mjs --url …` |
| Lighthouse, people and robot | `node tools/qa/lighthouse.mjs --url …` (`--as-bot` for the robot form) |
| a still of the running canvas (robot poster, phone stills) | `node tools/qa/capture-still.mjs --url …` |

### The measurement environment (get this wrong and every number below is a lie)

- **Measure a production build, never the dev server.** Dev invalidates §1 (the
  bundler serves chunks eagerly) and §4/§5 (React Strict Mode double-mounts,
  doubling listener counts and loops). `yarn build && yarn start` — and **kill
  the old server by port before rebuilding** (`next start` runs as
  `next-server`; `pkill -f "next start"` misses it), or it serves a stale
  manifest and you debug 404s that aren't yours. Gate the server start on the
  build's exit code — a failed build happily serves the previous `.next` and
  your A/B compares the old build with itself.
- **Probes need a person's UA.** The starter's proxy serves crawlers (and
  puppeteer's default UA) the robot form — no scene, no motion. A probe that
  "proves" a fix on the robot form proved nothing. The `tools/qa` tools set a
  plain Chrome/Safari UA; your own scripts must too.
- **Use `waitUntil: "load"` plus a fixed settle.** `networkidle0` never fires
  against `next start`.
- **SwiftShader is not a GPU.** Absolute fps out of headless Chrome is
  meaningless. Only *counted* quantities transfer: draw calls, vertices,
  drawing-buffer pixels, listener counts, program-link timestamps, main-thread
  block duration. `fps-probe` runs headed for that reason.
- **The scroll test's desktop is a 120 Hz panel**, like every ProMotion Mac.
  A scene that redraws every tick there does twice a 60 Hz screen's GPU work —
  see §5.
- **A shared machine moves numbers.** Interleave A/B arms (old, new, old, new)
  so both see the same load; build the baseline from a `git worktree` of the
  base branch, never by copying `.next/` or `node_modules/`.

Write the before/after numbers down. A change you cannot measure is a change you
cannot defend, and every item below costs something in look.

## 1. Never ship the scene to a robot

A crawler or Lighthouse's robot run gets **no scene at all** — not a hidden
canvas, not a lazily-idle module. The starter does this in the **proxy**, not
in the page: `src/proxy.ts` rewrites a bot UA (`src/utils/bot-ua.ts`, which
includes the AI crawlers) to the prerendered `/robot-view` route, where the
view renders a **still** in place of the scene. Read
`optimize-load/references/robot-path.md` before touching it.

- The scene component is a client leaf loaded with `import()` (or
  `dynamic(..., { ssr: false })`), so `three` lands in its own chunk and the
  robot form never fetches it. **Never re-export it from a barrel** next to
  lighter siblings — importing any sibling from the barrel pulls three.js into
  its chunk (observed).
- **Never `await isBot()` in a page or layout.** It reads `headers()` and makes
  the route dynamic for every visitor (no CDN cache). The UA belongs in the
  proxy (rule — the starter shipped that defect into most of the sites it
  seeded).
- **Importing drei for one hook pulls three.js into the first bundle**
  (observed: a loader importing `useProgress`). Import drei only inside the
  lazily loaded scene.
- **A scene started at module evaluation** (to beat hydration) can't read React
  context: gate its start on `isRobotView()` (the server's
  `<meta name="x-robot-view">`) once the document is parsed, and skip its model
  preloads on the robot form.

**The still.** It exists for (a) crawler and share-card screenshots, which
otherwise capture an empty box, and (b) the no-WebGL / context-lost fallback.
`node tools/qa/capture-still.mjs --url … --save public/assets/scene-still`
captures the running canvas with text and chrome hidden. Its wait must cover the
scene's own entrance, not just the loader. **Look at it** before wiring it. If
the camera fits to the tighter axis, one landscape still re-crops the subject on
portrait — export desktop and phone crops and pick with `<picture>`.

## 2. Tier the device at construction — and re-read it on a real change

One module decides what "mobile" means. Everything — DPR, particle counts,
bloom, whether the pointer is even listened to — reads from it, so the values
can never drift apart. Read it at construction and hold it in a mutable slot:
never recompute it per frame, and never rebuild buffers on every `resize` event.

`mobile` = `innerWidth < 768 || matchMedia("(hover: none) and (pointer: coarse)")`.
The coarse-pointer clause is what catches tablets and large phones.

**"Once" does not mean "never again".** The tier changes mid-session in real
cases: a window dragged across a breakpoint, DevTools device mode switched on or
off (which flips DPR, pointer and hover at once — the way most reviewers check a
phone layout), a tablet rotated. A scene that read the tier into a `const` kept
the 390-wide buffer, the parked pointer and the hidden desktop passes on a
2160-wide viewport and drew skewed until reload. So:

- Re-read the tier when the **width** changes or the pointer media query flips.
  Height-only changes on a coarse pointer are the iOS URL bar and are ignored
  (§13).
- When it changes, `retune(tier)`: re-apply DPR (renderer **and** composer, §6),
  per-tier visibility flags, bind or unbind the pointer listener (§11).
- Retune touches **uniforms, sizes, visibility and listeners only** — never a
  define, a light count or `material.transparent` (§3.2), so no program is
  compiled. Allocate the largest tier's particle buffer at construction and vary
  the count with `geometry.setDrawRange`.
- **Never decide layout from JS width on the server.** A `useIsMobile` that
  reads width 0 during SSR makes phones hydrate the desktop composition, then
  rebuild the mobile one (observed: ~0.25 s of the longest task). Switch layout
  with CSS breakpoints; where JS must decide, render both and hide one with CSS.

Also expose, from the same module:
- `prefersReducedMotion()` — an accessibility promise, honoured on every tier.
- `isEnergySaver()` — `navigator.connection.saveData` or `deviceMemory <= 2`.
- `sceneShouldSettle()` — reduced motion, or a constrained phone: play the
  entrance, then stop *advancing time*. **Do not stop drawing a visible canvas
  and trust the last frame** — iOS drops it after a toolbar resize or a
  re-composite and the scene "disappears" (§4). A settled scene still redraws on
  resize, visibility return and context restore.

## 3. Precompute and prewarm *everything* during the loader

This is the rule that kills micro-freezes. After the loader hands off, the frame
loop must allocate nothing, compile nothing and upload nothing. A stall on
scroll — or a frozen loader — is always one of five things:

1. **Shader compile / link.** `await renderer.compileAsync(scene, camera)`
   while the loader is still on screen. **Raw WebGL:** never read
   `COMPILE_STATUS` / `LINK_STATUS` in the task that compiled — poll
   `KHR_parallel_shader_compile`'s `COMPLETION_STATUS_KHR` once a frame first
   (observed: a gradient's mount 1,084 → 16 ms at 4× CPU). three.js reads every
   program's status and uniforms right after linking, so the main thread waits
   on the GPU compile (130–840 ms per scene build on a phone): set
   `renderer.debug.checkShaderErrors = false` in production.
2. **Program variants.** Three compiles a *new* program when a define changes —
   `USE_INSTANCING`, `transparent`, a different light count, `fog`, tone
   mapping, the render target's colour space. Never flip a define, a light
   count, `material.transparent` or `blending` at runtime. Set the final variant
   at construction and drive change through uniforms only.
3. **Texture and buffer upload.** The first `render` that samples a texture
   uploads it. `renderer.initTexture(tex)` for every texture during the loader.
   **Big attribute buffers: upload one per frame**, not all on the first draw
   (observed: seven ~17.7 MB grass buffers → one 84 ms mobile frame, gone when
   queued one per rAF).
4. **Render-target and post-pass warmup.** Each `EffectComposer` /
   `WebGLRenderTarget` allocates and compiles on its first use.
5. **CPU decode / parse.** Geometry decode, sampling, PCA fits, buffer
   building — pure work, the one most often missed because the other four are
   shader-shaped. On a throttled phone it blocks for *seconds* and lands while
   the loader animates. **Move it to a Worker** (rule, 6 sites):
   `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`
   (Turbopack bundles it), transfer buffers both ways, keep an inline fallback.
   Measured: 140k-point surface sampling in a `useMemo`, 2.6 s at 4× → worker:
   mobile TBT 4.3 s → 0.2 s, perf 52 → 85. Hold the reveal until the worker
   answers. **Keep the `new Worker(...)` launcher in its own file** — in the
   module the worker itself imports, `next build` hangs (observed). Build point
   clouds straight into `Float32Array`s, not via `SphereGeometry` and a copy
   (observed: 7× faster, start-up task 290 → 180 ms).

**How to prewarm so it actually covers the first frame** (rule — the same
family on 4+ sites):

- **Against the real targets.** With post-processing the scene renders into the
  composer's render target, whose program variants (MSAA, colour space) differ
  from the canvas's — a prewarm against the screen re-links every shader on
  frame one (measured: first frame 1,032 → 48 ms once warmed against the
  composer's targets). Bind the composer's targets while compiling and run the
  post passes once.
- **Visible while compiling.** three.js skips invisible objects. Make objects
  visible in the same step as the compile and the warming draw, hide them again
  before the frame is shown (observed: a recurring 69–116 ms frame gone).
- **Small tasks, one step per frame.** Read one program's uniforms per task,
  upload one object per task. Drive the warm-up from the render loop, one step
  per `requestAnimationFrame`: textures → scene shaders → extra materials → one
  frame each for every pass the first real frame uses (scene, bloom chain,
  composite). `setTimeout(0)` chains do **not** yield a frame — they ran
  back-to-back and the "split" work landed in one frame anyway (measured: first
  real frame 43–56 → 4–5 ms with per-rAF steps).
- **Gated passes compile on first use.** Skipping bloom at strength 0 moves its
  compile to the first scene where it turns on — mid-scroll. Run the pass once
  during warm-up regardless (observed: a 755 ms task gone).
- **Every keyframe of the timeline.** Render one frame at progress 0, 0.25,
  0.5, 0.75, 1 into a scratch target, so no branch or finale texture is reached
  for the first time mid-scroll.
- **Gated canvases.** A canvas that starts hidden behind a scroll flag compiles
  on its first draw: prewarm it with one hidden frame at mount (observed).

Verify: `renderer.info.programs.length` must not grow after the handoff.

**§1 and §3 pull against each other — check the gap, every time.**
Code-splitting the scene means it cannot compile until after hydration; on a
slow connection that lands *after* the loader hands off. Measure it (`linkProgram`
timestamps vs the handoff) and close it: start the scene's data fetch at first
paint (not a `<head>` preload — that bills the bytes to the LCP, see
`optimize-load`), and gate the loader on **scene-ready** rather than a fixed
duration.

**A scene far below the fold has no loader to hide behind** — its construction
lands inside the visitor's scroll. Mount it on **idle after load**, not on
proximity (observed). Don't move the build (or even the module's evaluation)
to well after `load` — that cured one site's scroll and cost mobile Lighthouse
8–9 points, because it fell in Lighthouse's window. Build **one idle task per
step** at the mount — renderer; each environment material pre-compiled with
`compileAsync` under PMREM's own state (`NoToneMapping`, a render target set —
both are in the program key, and so is the light count);
`fromScene(new Scene(), sigma)` once to build PMREM's private programs; the real
`fromScene`; the model's `compileAsync`; first render. Measured: mobile worst
frame 159 → 52 ms, Lighthouse mobile 71 → 75. Find the heavy step with
`tools/qa/profile.mjs --scroll-to "<selector>"`. Never defer preloads to
"after the entrance" either — their decode then lands on the first scroll.

> [!warning] The `as="fetch"` preload credentials trap
> An `as="fetch"` preload is only reused when its credentials mode matches the
> `fetch()` **exactly**. `crossorigin="anonymous"` + `credentials: "omit"` does
> *not* match; both silently download the asset twice. The pair that dedupes is
> `crossorigin="use-credentials"` + `credentials: "include"`. Count **network**
> requests (`page.on("request")`), not `fetch` calls.

## 4. Render only when visible — and always when visible

Gate the loop on all three:

- `document.hidden` — a background tab paints nothing.
- The section is on (or near) screen — `IntersectionObserver` with a
  `rootMargin` of about one viewport so it is already warm when it arrives.
- The canvas is actually visible (not faded to 0 by a wrapper).

Subscribe to **one app-wide rAF ticker** rather than a loop per scene. Several
forever-rAF scenes on one page were the documented cause of scroll jank on more
than one site — and a duplicate loop (StrictMode double mount, a loop started on
both mount and resize) also makes every per-frame increment run twice (§5).

**The other half — never stop drawing a visible canvas** (observed, iOS, on a
real phone): a "freeze the hero after 10 % scroll" optimisation relied on the
browser keeping the last frame; iOS drops it after a toolbar resize and the
stopped scene never repainted — the hero "disappeared". Pause only when the
canvas is off screen.

**Survive a lost context.** iOS drops WebGL contexts under memory pressure
(decoding big stills while the hero is off screen was enough) and nothing
rebuilds them — the scene is a permanent blank. Use `keepSceneAlive` from
`src/lib/scene/webgl-context.ts`: `preventDefault` the `webglcontextlost`;
when the scene nears the viewport, the tab returns or `pageshow` fires, check
`gl.isContextLost()` and rebuild on a fresh context **at rest** (no intro
replay; ≥ 1 s between rebuilds, 3 retries); `forceContextLoss()` on every
teardown so a rebuild never holds two contexts; don't allocate desktop-only
render targets on phones. Prove it with `tools/qa/context-loss-probe.mjs`
(FAIL → PASS on the site that taught it). Details: `mobile-device-qa`.

**r3f:** `<Canvas frameloop="never">` re-applies the prop on every re-render —
with a later `setFrameloop` the scene went black after the second resize
(observed). Own the loop in one place.

> [!warning] Clamping DPR on a `THREE.Points` scene changes its look
> `gl_PointSize` is in framebuffer pixels: at a lower DPR every point draws
> bigger on screen. Pass `uPixelScale = renderDpr / originalDpr` and multiply
> the size (and any minimum) by it (observed: 2 → 1.5 with the scale, pixel diff
> vs live = the scene's motion only).

## 5. Frame rate: never a fixed phone cap; 60 on fast desktop panels

This section replaced an older rule ("30 fps on phones") after real-phone
reviews. **Rule (5+ sites): no fixed phone frame cap.**

- A `t - last <= 1000/30` throttle on a 60 Hz loop draws every **3rd** frame
  (**20 fps**); on a 120 Hz iPhone every 5th (**26 fps** measured). A reviewer
  on an iPhone: "feels low FPS, looks really bad". Lifting the cap took
  scenes 26 → 120 fps at rest with the phone scroll test **unchanged or
  better** (1.19 → 0.58 % dropped on one site; ideal before and after on
  others).
- **A cap trips the scene's own fps fallback.** A scene with an adaptive-DPR
  monitor read the capped 26 fps as a weak device and dropped every phone to
  DPR 0.75 within ~2 s — the "noisy hero" seen on a real phone (observed, 2 sites).
  Any fps-driven DPR fallback must never sit under a frame cap.
- **Pay for scroll smoothness with a cheaper frame** (DPR, samples, particles,
  passes — §6, §7), and measure it with `tools/qa/fps-probe.mjs`: read the
  scene's `draws/s` against the page's `raf/s`; a budget throttle shows as
  draws ≈ raf/3 at 60 Hz.
- If a cap is truly unavoidable (the client accepts it), skip alternate frames
  (`frame % 2`) — never a budget throttle — and say so in the report.

**Desktop: cap the draw at 60 fps on fast panels** (rule, 6 sites). On a 120 Hz
panel a GPU-bound scene + post chain redraws every 8.3 ms tick; the scroll test
read 2–31 % dropped with the main thread idle. An accumulator that draws at most
every frame of 60 Hz took those to 0–1.9 %. Details that matter:

- Threshold **12.5 ms** (between a 120 Hz and a 60 Hz tick) — it never drops a
  frame on a 60 Hz screen to jitter.
- Gate only the **draw**. Keep per-tick easing (lerps written per frame)
  stepping every tick, or the cursor eases at half speed on 120 Hz.
- The shape is in `references/patterns.md` §16 (`frameBudgetMs` in §1 returns
  12.5 on desktop, 0 elsewhere).

**Speed must not follow the refresh rate.** Per-frame increments not scaled by
delta time run 2× at 120 Hz and 4× with a duplicate loop (observed: a phone
scene "2–4× too fast and shaking"). Every `+= k` becomes `+= k * dt * 60`; every
`lerp(a, b, k)` becomes `lerp(a, b, perFrame(k, dt))`; `dt` clamped
(`MAX_FRAME_DT`). One clock, in **seconds** for three.js (`createFrameClock`). Simulate 120 Hz headless by replacing
`requestAnimationFrame` with an 8 ms timer and compare pixel change per 1/60 s
against 60 Hz (`mobile-device-qa` §120 Hz).

## 6. Pixel ratio: clamp, clamp the composer too — and don't go noisy

```
phone    → 1.0 … 1.5  (soft point clouds may sit at 1; hard edges, a model, text → 1.5 + MSAA)
tablet   → ≤ 1.25 … 1.5
desktop  → ≤ 1.5     (cap even when the panel is 2×)
```

A 3× phone renders **9×** the fragments of a 1× screen, for no perceptible gain
on a point cloud or a soft shader — so clamp. But **below 1 reads as noise**:
real-phone review flagged two phone heroes as "noisy" — one at DPR 0.75, one at DPR 1
without MSAA (stair-stepped model edges, smeared print). DPR 1.5 + MSAA, no frame
cap, fixed both with performance held (production mobile 94). Look at a
crop at DPR 3 before and after any DPR change. Desktop ≤ 1.5 held on several
sites (rule); one desktop scene was capped at 1.5 at the client's request.

**`EffectComposer` owns its own render targets.** Clamp the renderer and leave
the composer at raw `devicePixelRatio` and you throw the saving away on the
post pass. Set both from the same function.

**Never let a canvas buffer follow a scroll-scrubbed box** (observed): a card
whose width/height scroll scrubs made R3F reallocate the buffer every frame
(100–235 ms `setSize` frames; a debounce didn't help). Hold the buffer at the
box's final size and stretch it over the live box with CSS.

## 7. Cut fill, not detail — the phone dies on fill rate

In order of what actually costs:

- **Particle counts, per tier.** Roughly a third of desktop on mobile. Cut the
  *sparse* end of the distribution first — the rim of a disc, the outer shell
  of a cloud. **After any count cut, check every structure that draws from the
  same pool** at its transition frames — a fixed grid filled row by row from the
  same beads came up a third short mid-wipe (observed).
  On a pre-baked point buffer, check its ordering before truncating
  `drawArrays` (`references/patterns.md` §8) — a spatially sorted buffer loses a
  *region*, not a sample.
- **Cull invisible particles in the vertex shader.** With additive blending a
  point whose brightness is exactly 0 adds nothing: move it off clip
  (`gl_Position = vec4(2.0, 2.0, 2.0, 1.0)`) — observed 7.8 → 4.6 ms GPU per
  frame, identical image.
- **Bloom.** Halve strength and radius on mobile, skip the pass when it
  contributes nothing (`enabled = strength > 0.001` — and warm it once, §3).
  Scale bloom by viewport height too.
- **Reflection probes.** A `CubeCamera.update()` is six more renders — never
  every frame for something that moves slowly (observed: every 3rd frame on
  desktop, every 6th on a phone).
- **Additive/transparent overdraw.** Fewer, larger sprites; cap `gl_PointSize`;
  `depthWrite: false` on transparents.
- **Post-processing chains that render nothing.** Audit them — composers that
  render empty layers are both a flicker and two wasted full-screen passes.
  Delete them.
- **Renderer flags.** `alpha: false` when the canvas is opaque,
  `stencil: false`, `depth: false` when nothing depth-tests,
  `powerPreference: "high-performance"` on desktop only. MSAA: off for soft
  point fields on phones, **on** for a model with hard edges (§6).
- **Shadow maps off on mobile.** Bake grounding into a texture.
- **Blur and glow layers over a moving canvas** are GPU fill too — a per-letter
  `filter: blur()` over a full-screen scene janked desktop scroll with the main
  thread idle. See `optimize-performance` (blur once per line).

## 8. Lights: as few as the look survives

Every real-time light multiplies the fragment cost of every lit material, and
changing the light *count* recompiles every program.

- **One** directional key + an environment map (IBL). A PMREM'd
  `RoomEnvironment` replaces three or four fills and looks better.
- Bake rim/fill into the material — a fresnel term in `onBeforeCompile` costs a
  few ALU ops and reads as a light.
- No point/spot lights on mobile unless the scene is about them.
- Never add or remove a light at runtime. Cutting per-frame passes of a lit
  scene (shadow, extra lights) without changing the look moved one site's GPU
  time measurably (observed).

## 9. Do transforms on the GPU, not the CPU — especially scroll

Any per-object transform that scroll drives should be a **uniform feeding the
vertex shader**, not a JS loop mutating `position`/`rotation` per frame.

- Positions computed in the vertex shader from `aOffset`/`aRandom` attributes +
  a `uProgress` uniform. Scroll then costs one uniform write per frame.
- `frustumCulled = false` on anything whose positions the shader computes.
- Where a whole group moves, move the `Group` (one matrix), never the children.
- Instancing / merged geometry for anything repeated.
- No per-frame `Vector3`/`Matrix4` allocation — module-scope scratch objects.
- Read `window.scrollY` **once per frame inside the ticker**. Never in a scroll
  handler that also writes styles.
- **Never write a CSS variable on `<html>` per frame** for the scene's sake (a
  pointer `--x/--y`): once it changed on every scrolled frame it restyled 571
  elements per frame and dropped 25–35 % of a section's frames (rule: write
  only on change, on the smallest element, never pointer vars during touch
  scroll).

## 10. Smooth the scroll progress on touch

On mobile the OS owns momentum scrolling, so `window.scrollY` arrives in
discrete steps and every derived value jitters. Low-pass it once, upstream:

```js
smoothed += (raw - smoothed) * kFrame;   // kFrame = 1 - Math.pow(1 - k, dt * 60)
```

- `k` 0.2–0.3 on mobile, ≈ 0.3 on desktop (Lenis eases the wheel, but steppy
  wheel input still shows as camera jitter).
- **Snap, don't crawl**, on a page jump: if `|raw - smoothed| > 1.5vh`, assign
  directly.
- Frame-rate independent always (§5) — a 120 Hz phone otherwise converges twice
  as fast as a 60 Hz one.

## 11. Pointer, gyroscope and raycasts on touch

On a touch device pointer effects are dead weight or actively wrong:

- Don't attach `mousemove` on the mobile tier at all. Gate every pointer effect
  on "has the pointer ever moved" — an unmoved cursor resolves to NDC (0,0),
  dead centre, so a repulsion field punches a hole in the middle of the scene on
  every phone.
- Bind and unbind from `retune()` (§2), not a one-shot check.
- **Raycast the shape, never the render mesh.** `intersectObject()` on a dense
  mesh per `pointermove` held one phone's scroll at 1–3 % dropped frames on its
  own; the analytic shape (`ray.intersectSphere`, `intersectPlane`) or a
  low-poly proxy: 0 % (observed).
- **A static hero model on phones may follow the gyroscope** instead —
  `src/lib/scene/device-tilt.ts` (`startTilt()` on mount, `readTilt(dt)` per
  frame, `stopTilt()` on unmount; iOS permission on a tap, idle sway, off for
  robots and reduced motion). It is a taste call: it was kept on most
  sites and removed on some. Ask. Wiring and proof:
  `mobile-device-qa` §gyroscope.

## 12. Compress the assets

- **First ask what the page reads from the model.** A particle scene that
  samples the mesh's triangles draws no texture, UV or normal: strip them all
  (POSITION + indices only — a gltf-transform script: dispose textures, null
  other attributes, `prune`). Observed: 4.67 MB → 61 KB, vertex/index count and
  a position hash identical.
- **Geometry**: Draco when the geometry is the weight (observed); keep the
  decoder local (`/draco/`), not on a CDN.
- **Textures**: check the list first (`npx @gltf-transform/cli inspect in.glb`
  — one 8 MB GLB carried eight uncompressed PNGs).
  `npx @gltf-transform/cli webp in.glb out.glb --quality 85`
  (`EXT_texture_webp`, read by three's GLTFLoader with no extra loader):
  observed 8.55 → 1.67 MB, desktop LCP 7.3 → 1.9 s. It saves bytes, not VRAM;
  KTX2 (`--texture-compress ktx2`, needs KTX-Software's `toktx`) is the step for
  GPU pressure.
- **Ship textures at the size the GPU uses.** A 6000² map on a device whose
  `maxTextureSize` or the scene's cap is 4096 (2048 on phones) is resampled on
  the main thread before upload. Build per-tier models
  (`gltf-transform resize → webp → draco`) and pick by tier (observed, with a
  post-paint start: mobile 51 → 87).
- `anisotropy = 1` on soft scenes on mobile (raise to 4 for a printed/textured
  model the eye reads), `generateMipmaps` for anything minified.
- Encode background **video** by role (a desktop file and a phone file,
  `<source media>`) — see `optimize-load`.

## 13. iOS: the toolbar, the canvas box, the compositor

Owned in depth by `mobile-device-qa`; the scene-side rules:

- **Size the scene box to the large viewport, not the dynamic one.** Safari's
  URL bar changes `innerHeight` as you scroll; a box sized `100dvh` /
  `fixed inset-0` / `innerHeight` follows it, the renderer reallocates (a
  cleared, blank frame) and redraws — "the scene flickers on scroll" (rule, 4
  sites). Use `src/components/common/scene-viewport.tsx` /
  `src/utils/stable-viewport.ts`: the box at `100lvh` measured once, re-measured
  on touch devices **only on a width change**.
- **Keep the resize listener on every tier** and skip only height-only changes
  on a coarse pointer. Listening only for `orientationchange` on touch broke a
  real width change (a DevTools preset back to desktop, split screen) — the
  canvas stayed phone-sized (observed).
- **Skip a resize whose size + DPR didn't change; draw immediately on a real
  one** — `setSize` clears the buffer.
- **The worker side too.** An OffscreenCanvas worker cleared its buffer in its
  *own* resize handler; guard it the same way (§15).
- `lvh` is for the **canvas**, not for static UI: a full-screen menu sized
  `inset-0`/`h-lvh` hides its foot under Safari's bottom toolbar — menus are
  `top-0 h-dvh` + safe-area padding.
- Promote the canvas wrapper to its own layer (`transform-gpu backface-hidden
  will-change-transform`) — a neighbouring fixed element repainting can
  invalidate the WebGL composite on WebKit.
- All scroll/pointer listeners `{ passive: true }`. Clamp `dt` (§5).
- Dispose on unmount: geometries, materials, textures, render targets,
  `renderer.dispose()`, `forceContextLoss()`, every listener.

Prove it: `node tools/qa/ios-toolbar-probe.mjs --url … --scroll 0.3` (steps the
height 844 → 760 → 844 …, asserts no buffer/box change and no blank frame,
then rotates and expects a resize). Headless height steps shrink `lvh`
sections with the window — a real iPhone doesn't; compare positions relative to
the section. Headless Chrome missed an iOS-only scene bug twice: when the bug is
iOS-only, reproduce it in WebKit (`tools/qa/webkit-probe.mjs`).

## 14. Verify, then write it down

Re-measure the §0 numbers and report the delta honestly:

- `renderer.info.render.calls` and `.programs.length` before vs after (raw
  WebGL: `__p.draws`, `__p.links.length`); the program count must be **stable
  after the loader**. On a raw scene every `links` timestamp must precede the
  handoff.
- `tools/qa/fps-probe.mjs` — the scene's draws/s at rest and scrolling, phone
  and desktop; no fixed caps (§5).
- `tools/qa/scroll-test.mjs` — PC (wheel) and mobile (touch, 4× CPU), cold and
  warm. The bar: **no frame over 50 ms, ≤ 1 % dropped, both devices.**
- `tools/qa/lighthouse.mjs` people and `--as-bot` — the robot form must show no
  three.js in its network list.
- `tools/qa/ios-toolbar-probe.mjs` and `tools/qa/context-loss-probe.mjs` for any
  full-viewport or long-lived scene.
- **Look at it.** Screenshots before/after at 390×844 DPR 3 and 1440×900; any
  visual-weight trade (fewer particles, lower DPR, lighter bloom) must still
  look designed. Fill-rate wins are invisible in a profiler and obvious in the
  hand — and a real phone is the final check; say so if you couldn't use one.
- **Tier round-trip.** Load with DevTools phone emulation on, then off: the
  buffer jumps to desktop size, the pointer effect comes back,
  `programs.length` does **not** grow. `tools/qa/resize-check.mjs` automates the
  device-preset switch.

Then, in the same turn, update the vault: `obsidian/meta/changelog.md` with the
before/after numbers; a trade-off you chose (a look sacrificed for a tier) → an
ADR in `decisions-log.md` **with the reasoning**; a measured fix that would help
the next project → `obsidian/knowledge/fix-catalog.md` (evidence, rule vs
observed); something that misled you → `obsidian/knowledge/pitfalls.md`.

## 15. The whole scene in a worker (OffscreenCanvas)

When the scene's set-up is one 300 ms+ task (env-map build, shader compile,
three.js evaluation) that no step-splitting cures, render it in a worker:
`canvas.transferControlToOffscreen()` → a module worker runs the unchanged
scene code; the page forwards pointer, visibility and size. **Rule** (3 sites:
mobile 91 → 98, 86 → 91; TBT 298 → 60 ms) — with limits, each learned the hard
way:

- **The scene must use no DOM APIs.** Check first.
- **Start it after `load`, in its own task.** Started during hydration it made
  TBT *worse* (553 vs 448 ms); after load 409 ms.
- **Phones and tablets only.** On desktop TBT is already ~0 and the worker's
  frames land outside the page's own frame — one desktop scroll went 0 → 5 %
  dropped. Keep a main-thread path that renders the same frame.
- **The worker owns its frame loop; the page posts state only on change**
  (rounded) — not every frame.
- **It must not out-draw the page.** The scroll test's 4× CPU throttle slows a
  main-thread scene but not the worker, so a full-rate worker competed with the
  page's frames (phone scroll ideal → smooth). Pace it to the page's rAF
  (post a tick from the page's loop) rather than a fixed fps cap (§5).
- **One clock, in seconds.** A worker fed the rAF timestamp in milliseconds
  where the page path passed seconds ran every timed motion ~1000× fast — the
  a reviewer saw it "2–4× too fast and shaking" (no instrument sees speed:
  Lighthouse and the scroll test count frames). Log the scene's time value on
  both paths for one second, or compare pixel change per 1/60 s.
- **Resize in the worker too** — skip same size + DPR, draw at once on a real
  change (§13).

## What not to do

- Don't drop the scene on mobile wholesale. The scene is the product; tier it.
  (A pinned scroll-story *may* become "hero live, the rest in flow over stills"
  on phones — only with the client's explicit sign-off; stills recipe in
  `mobile-device-qa`.)
- Don't add a fixed phone frame cap. Don't add a desktop cap above the draw
  (gate the draw, not the easing).
- Don't stop drawing a canvas that is on screen.
- Don't tune by feel on a desktop. Every number here was measured on a phone.
- Don't write a second `device.ts`/ticker — extend the one in the project.
- Don't ship `lil-gui` hidden — it is still parsed. Tree-shake it behind a dev
  flag. No `console.log`, `Stats` or disabled `OrbitControls` in production.
