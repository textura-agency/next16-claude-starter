# Patterns — copy-paste implementations

Every block here is either lifted from a project in this workspace or is the
generalised form of one. Ported from `helion` / `mycelia` (the optimised
descendants of `helios`) and `stride`. Adapt the framework glue; keep the
reasoning comments — they are why the numbers are what they are.

---

## 1. `lib/scene/device.ts` — the single source of tiering

Source: `helion/src/lib/scene/device.ts` (fullest version), `mycelia/src/lib/scene/device.ts`.

```ts
export type DeviceTier = "mobile" | "tablet" | "desktop";

const TABLET_MAX = 1180;
const MOBILE_MAX = 768;

/** The media-query half of the tier. Subscribe to it (§5): DevTools emulation
 *  and a mouse plugged into a tablet flip it without any `resize` event. */
export const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";
export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(COARSE_POINTER_QUERY).matches;

/** Read at scene construction and held in a mutable slot. Never recompute per
 *  frame and never rebuild buffers on every `resize` event — but DO re-read it
 *  when the width or the pointer media query changes (§5). Otherwise a window
 *  dragged across a breakpoint, or emulation switched off, keeps the phone
 *  tier on a desktop viewport and the scene draws skewed until reload. */
export const deviceTier = (): DeviceTier => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  const coarse = isCoarsePointer();

  if (width < MOBILE_MAX || coarse) return "mobile";
  if (width < TABLET_MAX) return "tablet";
  return "desktop";
};

/** Below 1.0 on mobile: these scenes are decorative, fill-bound, and the sprites
 *  are soft — rendering at 0.85× and letting the browser upscale is invisible and
 *  cuts ~a third of the fragments. Raise to 1.0 for hard-edged geometry (warp
 *  streaks, thin lines, in-shader text), which aliases visibly. */
const MOBILE_MAX_DPR = 0.85;

export const clampedPixelRatio = (tier: DeviceTier = deviceTier()): number => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  if (tier === "mobile") return Math.min(dpr, MOBILE_MAX_DPR);
  return Math.min(Math.max(dpr, 0.75), 1.5);
};

/** Minimum ms between scene frames. 30fps on a phone is the single biggest win
 *  available: the scene is fill-bound, not motion-bound. Throttled per ticker
 *  subscriber, so this never slows the springs sharing the loop. */
export const frameBudgetMs = (tier: DeviceTier = deviceTier()): number => {
  if (tier === "mobile") return 1000 / 30;
  if (tier === "tablet") return 1000 / 45;
  return 0; // desktop: every rAF tick
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Best-effort "spend less here". Data Saver is the nearest web-exposed proxy
 *  for iOS Low Power Mode, which has no API. Both inputs are absent on most
 *  desktops, so this only ever trips on a constrained client. */
export const isEnergySaver = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData === true) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0) {
    return nav.deviceMemory <= 2;
  }
  return false;
};

/** Play the entrance once, then stop drawing on a settled frame. WebGL keeps the
 *  last frame on the canvas, so a frozen scene costs nothing on scroll or idle. */
export const sceneShouldFreeze = (tier: DeviceTier = deviceTier()): boolean =>
  prefersReducedMotion() || (tier === "mobile" && isEnergySaver());

/** Point sizes are set in device px, so a mark tuned on a tall screen occupies a
 *  larger fraction of a short one — additive sprites pile up and bloom blows out.
 *  Scale both by viewport height against a reference. */
const VIEW_SCALE_REFERENCE = 1080;
export const viewScale = (): number =>
  typeof window === "undefined"
    ? 1
    : Math.min(1, Math.max(0.5, window.innerHeight / VIEW_SCALE_REFERENCE));

/** Whether to attach pointer listeners at all. */
export const wantsPointer = (tier: DeviceTier = deviceTier()): boolean =>
  tier !== "mobile";

export const byTier = <T,>(tier: DeviceTier, values: Record<DeviceTier, T>): T =>
  values[tier];
```

---

## 2. One shared rAF for the whole page

Source: `helion/src/lib/animation/ticker.ts`.

```ts
export type TickerCallback = (time: number) => void;

interface Subscriber {
  callback: TickerCallback;
  getFramerate: () => number; // read live, so a tier/prop change takes effect
  last: number;
}

const subscribers = new Set<Subscriber>();
let rafId: number | null = null;

const frame = (time: number): void => {
  // Snapshot: a callback may subscribe/unsubscribe during iteration.
  for (const sub of [...subscribers]) {
    if (!subscribers.has(sub)) continue;
    if (time - sub.last <= sub.getFramerate()) continue;
    sub.last = time;
    try {
      sub.callback(time);
    } catch (error) {
      // One bad subscriber must not kill the shared loop.
      console.error("[ticker] subscriber threw:", error);
    }
  }
  rafId = requestAnimationFrame(frame);
};

export const subscribeToTicker = (
  callback: TickerCallback,
  getFramerate: () => number,
): (() => void) => {
  const subscriber: Subscriber = { callback, getFramerate, last: performance.now() };
  subscribers.add(subscriber);
  if (rafId === null) rafId = requestAnimationFrame(frame); // ref-counted start
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
};
```

---

## 3. Prewarm — everything compiled, uploaded and touched before handoff

This is the anti-micro-freeze pass. Run it while the loader still owns the
screen. Nothing here may run again after handoff.

```ts
/**
 * Compile every program, upload every texture, allocate every render target and
 * touch every branch of the scroll timeline — before the loader hands off.
 *
 * After this returns, the frame loop allocates nothing, compiles nothing and
 * uploads nothing. Every mid-scroll hitch is one of those three.
 */
async function prewarm(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  composer: EffectComposer | null,
  setProgress: (uProgress: number) => void,
  onPercent?: (p: number) => void,
) {
  // 1. Every material must be IN the scene graph now — including ones that are
  //    visible = false. Three only compiles what it can reach.
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });

  // 2. Textures: the first render that samples one uploads it. A 2K PNG upload
  //    mid-scroll is a visible hitch.
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of list) {
      for (const value of Object.values(m as Record<string, unknown>)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          if (u.value instanceof THREE.Texture) textures.add(u.value);
        }
      }
    }
  });
  textures.forEach((t) => renderer.initTexture(t));
  onPercent?.(30);

  // 3. Programs. compileAsync yields to the main thread, so the loader keeps
  //    animating; compile() is the sync fallback for older three.
  if ("compileAsync" in renderer) {
    await (renderer as unknown as {
      compileAsync: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
    }).compileAsync(scene, camera);
  } else {
    renderer.compile(scene, camera);
  }
  onPercent?.(60);

  // 4. Walk the whole scroll timeline into a 1×1 scratch target. Any program
  //    created lazily, any shader branch reached only in the finale, any texture
  //    bound only at the end — all touched here, none mid-scroll.
  const scratch = new THREE.WebGLRenderTarget(1, 1);
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(scratch);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    setProgress(p);
    renderer.render(scene, camera);
  }
  renderer.setRenderTarget(prevTarget);
  scratch.dispose();
  onPercent?.(85);

  // 5. The post chain allocates and compiles on first use too. One full frame
  //    through the COMPLETE chain, at real size.
  composer?.render();

  setProgress(0);
  hidden.forEach((o) => (o.visible = false));
  onPercent?.(100);
}
```

### Chunk long CPU builds across frames

A particle buffer built in one synchronous loop blocks the loader. Chunk it and
feed the loader percentage from it — that is what the loader is for.

```ts
async function buildInChunks<T>(
  total: number,
  step: (i: number) => void,
  onPercent?: (p: number) => void,
  budgetMs = 8,
) {
  let i = 0;
  while (i < total) {
    const start = performance.now();
    while (i < total && performance.now() - start < budgetMs) step(i++);
    onPercent?.(Math.round((i / total) * 100));
    await new Promise(requestAnimationFrame);
  }
}
```

### Move pure CPU decode off the main thread entirely

Chunking (above) keeps the loader animating; a Worker removes the work from the
main thread altogether, and is the better answer whenever the work is *pure* —
geometry decode, normal estimation, PCA plane fits, buffer building. Measured:
50k plane fits blocked the main thread for 3.9 s on a throttled phone, during
the loader, freezing its counter and dropping input.

```ts
// worker.ts — no DOM, no three.js import; just typed arrays in and out.
self.onmessage = (e: MessageEvent<{ positions: ArrayBuffer; count: number }>) => {
  const positions = new Float32Array(e.data.positions);
  const normals = new Float32Array(positions.length);
  // …the expensive pure transform…
  // Transfer *back* as well, or the result is structured-cloned (a full copy).
  self.postMessage({ normals: normals.buffer }, [normals.buffer]);
};
```

```ts
// caller — transfer in both directions, and keep an inline fallback.
export async function buildNormals(positions: Float32Array): Promise<Float32Array> {
  if (typeof Worker === "undefined") return buildNormalsInline(positions);

  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<Float32Array>((resolve, reject) => {
      worker.onmessage = (e) => resolve(new Float32Array(e.data.normals));
      worker.onerror = reject;
      // `positions.buffer` is neutered here — hand over a copy if the caller still needs it.
      worker.postMessage({ positions: positions.buffer, count: positions.length / 3 },
                         [positions.buffer]);
    });
  } finally {
    worker.terminate();
  }
}
```

Note the two transfer lists. Miss either one and a 50 MB buffer is copied, which
is its own main-thread block — the thing you moved the work to avoid.

### Program-variant discipline

```ts
// ✗ recompiles the program mid-scroll — a 50-200ms stall on a phone
material.transparent = progress > 0.5;
mesh.material.blending = THREE.AdditiveBlending;
scene.add(new THREE.PointLight());          // light count change = every program recompiles
material.defines.USE_FANCY = 1; material.needsUpdate = true;

// ✓ variant fixed at construction, change driven through uniforms only
material.transparent = true;
material.uniforms.uOpacity.value = progress > 0.5 ? 1 : 0;
```

---

## 4. Visibility-gated render loop

### Plain / vanilla — `stride/src/lib/three/chain-scene.ts`

```ts
// Three WebGL scenes each running their own forever-rAF was the main cause of
// scroll jank here. Only render while the section is on (or near) screen.
let raf = 0;
let running = false;

const loop = () => {
  render();
  raf = requestAnimationFrame(loop);
};
const startLoop = () => {
  if (running) return;
  running = true;
  lastScroll = window.scrollY; // reset, so a paused gap doesn't inject a spin spike
  raf = requestAnimationFrame(loop);
};
const stopLoop = () => {
  if (!running) return;
  running = false;
  cancelAnimationFrame(raf);
  raf = 0;
};

// rootMargin ≈ one viewport: warm before it arrives, cold once it's gone.
const io = new IntersectionObserver(
  ([entry]) => (entry.isIntersecting ? startLoop() : stopLoop()),
  { rootMargin: "100% 0px" },
);
io.observe(container);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopLoop();
  else if (io.takeRecords().length === 0 && inView) startLoop();
});
```

### Scroll-range test — `helion/src/lib/scene/scroll-state.ts`

```ts
/** Is the scene worth drawing this frame? A hidden tab paints nothing; below the
 *  point the canvas has fully faded out, neither does the scene. */
export const isSceneVisible = (): boolean => {
  if (typeof document !== "undefined" && document.hidden) return false;
  if (scrollState.activeScreen === screens.NONE) return true;

  const anchor = scrollState.slideRange[screens.IMPACT];
  if (!anchor) return true;

  const { scrollY, vh } = scrollState;
  return scrollY - anchor.top < vh * SCENE_GONE_AT;
};
```

### The React leaf that wires it together — `helion/.../scene/scene.tsx`

```tsx
useEffect(() => {
  const animation = new Canvas(parentRef.current!, canvasRef.current!);
  const unsubscribeMouse = wantsPointer() ? subscribeMouse() : () => {};

  const budget = frameBudgetMs();
  const freeze = sceneShouldFreeze();
  let frozen = false;
  let settleStart = 0;

  const unsubscribeTicker = subscribeToTicker(
    (time) => {
      if (frozen || !isSceneVisible()) return;
      animation.render(time);
      // Reduced-motion / energy-saver: keep drawing until the loader hands off
      // plus a short settle window, so we freeze on a fully-formed frame.
      if (freeze && loadedRef.current) {
        const now = performance.now();
        if (settleStart === 0) settleStart = now;
        else if (now - settleStart > FREEZE_SETTLE_MS) frozen = true;
      }
    },
    () => budget,
  );

  return () => {
    unsubscribeTicker();
    unsubscribeMouse();
    animation.unmount(); // disposes geometries, materials, targets, renderer
  };
}, []);
```

```tsx
{/* h-lvh/w-lvw: iOS Safari's address bar changes the dynamic viewport, so size
    against the LARGEST viewport. transform-gpu + backface-hidden promote the
    wrapper to its own compositor layer — without it, a neighbouring fixed element
    repainting during scroll invalidates the WebGL composite on WebKit and the
    whole scene flickers. */}
<div className="pointer-events-none fixed inset-0 h-lvh w-lvw transform-gpu backface-hidden will-change-transform">
  <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full transform-gpu" />
</div>
```

---

## 5. Canvas sizing that survives the iOS URL bar

Source: `mycelia/src/lib/scene/canvas3d.ts`.

```ts
/* The resize path runs on EVERY tier. `mycelia` attaches no listener at all on
 * touch to dodge the iOS URL bar (Safari fires `resize` each time the bar
 * collapses during scroll, and rebuilding the framebuffer mid-scroll reads as a
 * full-scene flicker). That over-corrects: a viewport that really changes — a
 * window dragged across a breakpoint, a rotation, DevTools emulation switched
 * off — then kept the phone-sized buffer, budget, parked pointer and hidden
 * passes, and the scene drew skewed until reload. Do not port that part.
 *
 * The URL bar only ever moves `innerHeight`. So: on a coarse pointer, ignore a
 * height-only change. A width change, or a flip of the pointer media query,
 * re-reads the tier and retunes before the surface is resized. */
private currentTier: DeviceTier = deviceTier();
private lastWidth = window.innerWidth;
private lastHeight = window.innerHeight;
private readonly pointerQuery: MediaQueryList | null =
  typeof window.matchMedia === "function" ? window.matchMedia(COARSE_POINTER_QUERY) : null;

private readonly boundResize = (): void => {
  if (this.resizeRafId !== null) return;   // coalesce: many events, one resize
  this.resizeRafId = requestAnimationFrame(() => {
    this.resizeRafId = null;
    this.handleViewportChange();
  });
};

// in the constructor — every tier, no `isTouchDevice` branch
window.addEventListener("resize", this.boundResize, { passive: true });
window.addEventListener("orientationchange", this.boundResize, { passive: true });
this.pointerQuery?.addEventListener("change", this.boundResize);

private handleViewportChange(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const widthChanged = width !== this.lastWidth;
  const heightOnly = !widthChanged && height !== this.lastHeight;
  this.lastWidth = width;
  this.lastHeight = height;

  /* iOS URL bar: coarse pointer, height moved, width did not. Leave the
   * framebuffer alone — the canvas is `lvh`-sized, so nothing is uncovered. */
  if (heightOnly && isCoarsePointer()) return;

  const tier = deviceTier();
  if (tier !== this.currentTier) {
    this.currentTier = tier;
    this.retune(tier);
  }
  this.resizeSurface();
}

/* Re-apply everything that reads the tier. Uniforms, sizes, visibility,
 * draw ranges and listeners only — never a define, a light count or
 * `material.transparent` (SKILL §3.2) — so this compiles no program. */
private retune(tier: DeviceTier): void {
  this.frameBudget = frameBudgetMs(tier);          // the ticker reads this per tick
  this.wireframe.visible = tier === "desktop";     // per-tier passes / flags
  this.points.geometry.setDrawRange(0, COUNT[tier]); // §7: largest buffer allocated up front
  this.setPointerBinding(wantsPointer(tier));      // §11: bind or unbind, never "attach and ignore"
  this.composer?.resize(tier);                     // §9: the composer follows the clamp
  const freeze = sceneShouldFreeze(tier);
  if (this.frozen && !freeze) this.unfreeze();     // desktop again → draw again
  else if (!this.frozen && freeze) this.freezeOnSettledFrame();
  // DPR is applied in resizeSurface(), which always follows a retune.
}

private resizeSurface(): void {
  const rect = this.parent.getBoundingClientRect();
  const width = this.checkWindow ? window.innerWidth : rect.width;
  const height = this.checkWindow ? window.innerHeight : rect.height;
  const ratio = clampedPixelRatio(this.currentTier);
  if (this.width === width && this.height === height && this.ratio === ratio) return;

  this.canvas.width = this.width = width;
  this.canvas.height = this.height = height;
  /* Clamped, not raw. A 3× phone would render 9× the fragments of a 1× screen
   * through additive halos, for no visible gain on soft point sprites. */
  this.ratio = ratio;
  this.renderer.setSize(width, height, false);
  this.renderer.setPixelRatio(this.ratio);
  this.resizing.forEach((fn) => fn());
}
```

Verified on a project that shipped the earlier, listener-less version: emulated
phone → 390×844 drawing buffer, 3 draws; emulation off → 2160×1350, 4 draws
(the wireframe pass back), **no new programs**; emulation on again → back to
the phone numbers. A URL-bar collapse on device still produces no resize.

Renderer construction, per tier:

```ts
const tier = deviceTier();
this.renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: tier === "desktop",   // MSAA on a phone is expensive; the DPR clamp hides its absence
  alpha: false,                    // opaque canvas → skip the blend against the page
  stencil: false,
  depth: sceneNeedsDepth,
  powerPreference: tier === "desktop" ? "high-performance" : "default",
});
this.renderer.shadowMap.enabled = false; // VSM on mobile is the most expensive option there is
```

---

## 6. Scroll smoothing on touch

Source: `helion/src/components/common/sections/section-controller.tsx`.

```ts
/** Lerp factor for mobile scroll smoothing. Retention 0.75 ⇒ k = 0.25 — the same
 *  number said two ways. Higher = snappier and less laggy; lower = smoother but
 *  the scene visibly trails your thumb. 0.08 (≈135 ms half-life) felt disconnected
 *  once the scene ran at 30 fps, because the two lags compound. 0.22 (≈28 ms) still
 *  absorbs the discrete jumps of native momentum scrolling while tracking the thumb. */
const SMOOTH_LERP = 0.22;
/** Lenis eases the wheel, but the scene reads scrollY raw each frame, so steppy
 *  wheel input still shows as jitter in the camera flight. */
const DESKTOP_LERP = 0.3;
/** Snap rather than crawl when a jump exceeds this many viewports. */
const SNAP_THRESHOLD_VH = 1.5;

let smoothedScrollY = window.scrollY;
let smoothMode = deviceTier() === "mobile";
let last = performance.now();

const tick = (time: number) => {
  const vh = window.innerHeight;
  const rawY = window.scrollY;                 // read once per frame, in the ticker

  // Frame-rate independence matters once the tier caps fps.
  const dt = Math.min(0.05, (time - last) / 1000);
  last = time;
  const base = smoothMode ? SMOOTH_LERP : DESKTOP_LERP;
  const k = 1 - Math.pow(1 - base, dt * 60);

  if (Math.abs(rawY - smoothedScrollY) > vh * SNAP_THRESHOLD_VH) {
    smoothedScrollY = rawY;                    // anchor jump: snap, don't crawl
  } else {
    smoothedScrollY += (rawY - smoothedScrollY) * k;
  }

  scrollState.scrollY = smoothedScrollY;       // every downstream value inherits the easing
};
```

---

## 7. Pointer, gated

Source: `helion/src/lib/scene/mouse.ts`, `mycelia/.../objects/vortex.ts`.

```ts
let mouse: MouseEvent | null = null;
let listeners = 0;

/** One reference-counted listener serves every consumer; it detaches when the
 *  last one unsubscribes. Not attached at all on the mobile tier. */
export const subscribeMouse = (): (() => void) => {
  if (typeof window === "undefined" || !wantsPointer()) return () => {};
  if (listeners === 0) window.addEventListener("mousemove", onMouseMove, { passive: true });
  listeners += 1;
  return () => {
    listeners -= 1;
    if (listeners === 0) {
      window.removeEventListener("mousemove", onMouseMove);
      mouse = null;
    }
  };
};

/** Has the pointer EVER moved. Scenes that repel particles from the cursor must
 *  gate on this: before the first mousemove the cursor resolves to NDC (0,0) —
 *  dead centre — so an ungated void punches a hole through the middle of the
 *  scene, which is exactly what a touch device or an untouched page shows. */
export const hasPointer = (): boolean => mouse !== null;
```

```ts
// In the object's render(): ease the influence in, never snap it.
this.pointerActive.value = lerp(this.pointerActive.value, hasPointer() ? 1 : 0, 0.05);
const target = this.pointerNdc();
this.pointer.x = lerp(this.pointer.x, target.x, 0.09);
this.pointer.y = lerp(this.pointer.y, target.y, 0.09);
```

---

## 8. Per-tier counts

Source: `mycelia/src/components/common/scene/three/objects/vortex.ts`.

```ts
/**
 * Filaments × points-per-filament, per tier.
 *
 * `radialExpo` crowds points toward the core, so the rim is always the sparse
 * end. Cutting `perFilament` thins the rim first, which is where it shows least.
 * Never cut uniformly — cut the sparse end of the distribution.
 */
const COUNT = {
  desktop: { filaments: 460, perFilament: 420 },  // ~193k points
  tablet:  { filaments: 300, perFilament: 300 },  // ~90k
  mobile:  { filaments: 170, perFilament: 190 },  // ~32k
} as const;

this.counts = COUNT[deviceTier()];
```

Sizes and halos scale with the window too, or a look tuned on a big screen blows
out on a short one:

```ts
this.matPoints.uniforms.uSize.value = BASE_SIZE * viewScale();
```

### Before truncating a *baked* point buffer, check its ordering

With a pre-quantised point file the only lever is drawing fewer vertices — and
whether that is a *sample* or a *hole* depends on the buffer's point ordering,
which no exporter documents. Bucket into deciles and compare mean coordinates:
monotonic drift means the points are spatially ordered, so the first N is a
region, not a sample.

```js
// node check-ordering.mjs points.bin   → run once, before you touch drawArrays.
import { readFile } from "node:fs/promises";

const buf = new Float32Array((await readFile(process.argv[2])).buffer);
const n = buf.length / 3;
for (let d = 0; d < 10; d++) {
  const lo = Math.floor((d * n) / 10), hi = Math.floor(((d + 1) * n) / 10);
  let x = 0, y = 0, z = 0;
  for (let i = lo; i < hi; i++) { x += buf[i * 3]; y += buf[i * 3 + 1]; z += buf[i * 3 + 2]; }
  const k = hi - lo;
  console.log(d, (x / k).toFixed(3), (y / k).toFixed(3), (z / k).toFixed(3));
}
```

A monotonic column ⇒ **do not truncate.** One measured file was sorted
left→right, so drawing the first half would have deleted half the head. The only
real reduction there is re-sampling the asset offline (a `points-lite.bin`,
every k-th point or a Poisson thin), shipped as a per-tier asset like any other.

---

## 9. Bloom / composer

Source: `helion/src/components/common/scene/three/Composer.ts`,
`mycelia/.../Composer.ts`.

```ts
// The composer owns its OWN render targets. Leaving it at raw devicePixelRatio
// renders the post pass at full resolution and throws away the entire saving
// made on the scene pass. Must match Canvas3d's clamp.
resize() {
  this.composer.setSize(window.innerWidth, window.innerHeight);
  this.composer.setPixelRatio(clampedPixelRatio());
}

render() {
  const tier = deviceTier();
  const mobileCut = tier === "mobile" ? 0.5 : 1;

  this.bloomPass.strength = targetStrength * viewScale() * mobileCut;
  this.bloomPass.radius = targetRadius * mobileCut;

  /* Skip the pass outright when it contributes nothing. Otherwise a strength-0
   * bloom still runs a full-screen chain every frame — a pure saving, largest on
   * the fill-bound phones. */
  this.bloomPass.enabled = this.bloomPass.strength > 0.001;

  this.composer.render();
}
```

**Audit dead chains.** Both `mycelia` and `helion` inherited three chained
composers from `helios` where two rendered empty layers and the final pass
sampled stale render targets plus an unbound `sampler2D` (which reads texture
unit 0 — whatever was last bound, so the composite changed frame to frame). That
was simultaneously the flicker *and* two wasted full-screen passes per frame.
Check that every layer a composer renders actually contains objects, and that
every intermediate chain sets `renderToScreen = false`.

---

## 10. Scroll transforms in the vertex shader

The correct shape already exists in `clarix/3d-website/main.js` (logo particles):
per-particle data in attributes, one `uProgress` uniform, all interpolation on
the GPU.

```glsl
uniform float uProgress;      // the ONLY thing scroll writes, once per frame
uniform float uTime;
attribute vec3  aTarget;      // final position
attribute vec3  aOrigin;      // scattered origin
attribute float aDelay;       // per-particle stagger

void main() {
  float p  = clamp(uProgress, 0.0, 1.0);
  float t0 = aDelay * 0.4;
  float pp = clamp((p - t0) / (1.0 - t0), 0.0, 1.0);
  float ease = 1.0 - pow(1.0 - pp, 4.0);

  vec3 pos = mix(aOrigin, aTarget, ease);

  // Drift only while scattered — free, it's already in the vertex shader.
  float drift = 1.0 - ease;
  pos.x += sin(uTime * 0.4 + aOrigin.y) * 1.5 * drift;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(uSize / max(0.5, -mv.z), 2.0, 64.0); // cap: uncapped size is pure fill
  gl_Position  = projectionMatrix * mv;
}
```

```ts
// CPU side, per frame: one uniform write. That is the whole cost of scroll.
material.uniforms.uProgress.value = scrollProgress;

// Positions are computed in the shader, so Three's bounding sphere is stale —
// it would cull the object at the wrong moment.
points.frustumCulled = false;
```

Reuse scratch objects; never allocate in the loop:

```ts
const _v = new THREE.Vector3();          // module scope — `clarix` does this with _revealVec
function tick() {
  model.getWorldPosition(_v).project(camera);   // no per-frame allocation, no GC stall
}
```

Move the group, not the children:

```ts
group.position.z = -scroll * DIVE;       // one matrix update
// not: children.forEach(c => c.position.z = ...)
```

---

## 11. Lights and environment

Source: `stride/src/lib/three/chain-scene.ts`.

```ts
// One key light + an IBL replaces three or four fills and looks better than any
// of them. Every real-time light multiplies the fragment cost of every lit
// material, and changing the light COUNT recompiles every program.
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
pmrem.dispose();

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 6, 5);
scene.add(key);
```

Fake the rim in-shader instead of adding a light — a few ALU ops, reads as a
light (`clarix` already computes this fresnel; it just also ships three real
lights on top of it):

```glsl
float fresnel = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
vec3  rim     = uRimColor * pow(fresnel, 2.0) * 1.5;
```

---

## 12. Asset compression

```sh
# Geometry (Draco) + textures (KTX2/Basis) in one pass.
npx @gltf-transform/cli optimize in.glb out.glb \
  --texture-compress ktx2 --texture-size 1024 --compress draco
```

```ts
// Keep the decoder LOCAL. `clarix` fetches it from gstatic — a CDN round-trip on
// the critical path, and a third-party dependency for a first-paint asset.
const draco = new DRACOLoader().setDecoderPath("/draco/");
const ktx2 = new KTX2Loader()
  .setTranscoderPath("/basis/")
  .detectSupport(renderer);

const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
```

Why KTX2 matters more than the file size suggests: a compressed texture stays
compressed **in VRAM**. A PNG is decoded to raw RGBA on upload, so a 2048² PNG
costs 16 MB of GPU memory regardless of how well it zipped. On a phone that is
the difference between a smooth pan and texture-thrash stutter.

```ts
// Procedurally-drawn canvas textures: no mipmaps needed if never minified.
const texture = new THREE.CanvasTexture(canvas);
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.anisotropy = deviceTier() === "mobile" ? 1 : renderer.capabilities.getMaxAnisotropy();
```

---

## 13. Bot exclusion

Source: `helion/src/utils/is-bot.ts`.

```ts
import { headers } from "next/headers";

export const isBot = async (): Promise<boolean> => {
  const ua = ((await headers()).get("user-agent") || "").toLowerCase();
  return (
    ua.includes("lighthouse") || ua.includes("googlebot") ||
    ua.includes("pagespeed") || ua.includes("chrome-lighthouse") ||
    ua.includes("headlesschrome") || ua.includes("gtmetrix") ||
    ua.includes("pingdom") || ua.includes("bingbot") || ua.includes("yandexbot")
  );
};
```

```tsx
// Server component. The bot path never references the scene module, so `three`
// is not in the chunk graph it downloads — no fetch, no parse, no script
// evaluation time, which is exactly what the audit is measuring.
const Scene = dynamic(() => import("@/components/common/scene/scene"), { ssr: false });

export default async function Page() {
  const bot = await isBot();
  return (
    <>
      {bot ? <ScenePoster /> : <Scene />}
      <Content />
    </>
  );
}
```

Plain-HTML projects (the `portable.html` / template shape) — same idea, client-side:

```html
<canvas id="scene"></canvas>
<img id="scene-poster" src="poster.webp" alt="" />
<script type="module">
  const BOTS = /lighthouse|googlebot|pagespeed|headlesschrome|bingbot|yandexbot/i;
  if (!BOTS.test(navigator.userAgent)) {
    // three.js is only fetched and evaluated here.
    const { mountScene } = await import("./scene.js");
    mountScene(document.getElementById("scene"));
    document.getElementById("scene-poster").remove();
  }
</script>
```

The poster is the scene's first frame as a static image, so the layout never
shifts between the two paths.

---

## 14. Disposal

```ts
public dispose(): void {
  window.removeEventListener("resize", this.boundResize);
  window.removeEventListener("orientationchange", this.boundResize);
  this.pointerQuery?.removeEventListener("change", this.boundResize);
  this.setPointerBinding(false);
  if (this.resizeRafId !== null) cancelAnimationFrame(this.resizeRafId);
  this.stopRender();

  this.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    mats.forEach((m) => {
      Object.values(m as Record<string, unknown>).forEach((v) => {
        if (v instanceof THREE.Texture) v.dispose();
      });
      m.dispose();
    });
  });

  this.composer?.dispose();
  this.renderer.dispose();
  this.rendering = [];
  this.resizing = [];
}
```

---

## 15. Measurement snippets

```js
// Paste in the console with the scene running.
const before = { ...renderer.info.render, programs: renderer.info.programs.length };
// …scroll the full page…
console.table({ before, after: { ...renderer.info.render, programs: renderer.info.programs.length } });
```

`programs` **must not grow after the loader hands off.** If it does, §3 is
incomplete — a material or a shader variant is still compiling mid-scroll, and
that is the micro-freeze you were sent to fix.

```js
// Cheap in-page frame-time readout — long tasks show as spikes.
let last = performance.now(), worst = 0;
(function probe() {
  const now = performance.now();
  worst = Math.max(worst, now - last);
  last = now;
  requestAnimationFrame(probe);
})();
setInterval(() => { console.log("worst frame (ms):", worst.toFixed(1)); worst = 0; }, 2000);
```

### Raw WebGL — build the instrumentation first

A hand-written scene has no `renderer.info`, so there is nothing to read until
you make it. Hook the context **before app code runs** and count it yourself.
This is the §0 gate for any non-three.js scene: without it you cannot start.

```js
// harness.mjs — puppeteer
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: "new", args: ["--use-gl=swiftshader"] });
const page = await browser.newPage();

const requests = [];                       // §12 / preload dedupe: count NETWORK, not fetch()
page.on("request", (r) => requests.push(r.url()));

await page.evaluateOnNewDocument(() => {
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, attrs) {
    const ctx = gc.call(this, kind, attrs);
    if (ctx && kind === "webgl") {
      window.__gl = ctx;                   // for drawingBufferWidth/Height later
      window.__p = { draws: 0, verts: 0, frames: 0, links: [], attrs };
      const draw = ctx.drawArrays.bind(ctx);
      ctx.drawArrays = (m, f, c) => { window.__p.draws++; window.__p.verts += c; return draw(m, f, c); };
      const clear = ctx.clear.bind(ctx);
      ctx.clear = (m) => { window.__p.frames++; return clear(m); };
      const link = ctx.linkProgram.bind(ctx);
      ctx.linkProgram = (p) => { window.__p.links.push(Math.round(performance.now())); return link(p); };
    }
    return ctx;
  };
});

// `networkidle0` never fires against `next start` — use load + a fixed settle.
await page.goto("http://localhost:3000", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 6000));

console.log(await page.evaluate(() => ({
  draws: window.__p.draws,
  verts: window.__p.verts,
  frames: window.__p.frames,              // counted, not timed — see the note below
  links: window.__p.links,                // §3: every one must precede the loader handoff
  attrs: window.__p.attrs,                // §7 renderer flags
  buffer: [window.__gl.drawingBufferWidth, window.__gl.drawingBufferHeight],  // §6
})));
```

| three.js | raw WebGL equivalent |
|---|---|
| `renderer.info.render.calls` | `__p.draws` |
| `renderer.info.render.points/triangles` | `__p.verts` |
| `renderer.info.programs.length` | `__p.links.length` — and the timestamps are the §3 evidence |
| `renderer.getPixelRatio()` / target size | `gl.drawingBufferWidth × Height` |
| renderer constructor options | the captured `attrs` (§7 flags) |

### Environment rules — get these wrong and every number is a lie

1. **Production build only.** Dev invalidates §1 (chunks are served eagerly, so
   the bot path looks broken when it isn't) and §4/§5 (Strict Mode
   double-mounts: 2 listeners where there is 1, and a halved apparent fps).
2. **Kill the old server before rebuilding.** A stale `next start` holding the
   port serves an old manifest — 404s and 500s that read exactly like a code bug.
3. **`waitUntil: "load"` + a fixed settle.** `networkidle0` never fires here.
4. **SwiftShader is not a GPU.** Absolute fps from headless Chrome is
   meaningless (14 fps measured on a desktop). Only *counted* quantities
   transfer: draws, vertices, buffer pixels, listener counts, link timestamps,
   block duration.
5. **To see a frame cap (§5), remove the GPU as the limiter**: shrink the
   viewport to ~320×240 and re-measure. rAF at 120/s against 26 draws/s is the
   cap working.

```js
// Listener count (§4/§11) — install before app code, same evaluateOnNewDocument.
const add = EventTarget.prototype.addEventListener;
window.__l = {};
EventTarget.prototype.addEventListener = function (t, f, o) {
  window.__l[t] = (window.__l[t] || 0) + 1;
  return add.call(this, t, f, o);
};
```
