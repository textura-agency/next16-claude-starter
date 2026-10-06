// 📖 Docs: obsidian/frontend/webgl-scenes.md → "A lost context"

/**
 * WebGL context-loss recovery — the hero scene always comes back.
 *
 * iOS drops WebGL contexts under memory pressure (decoding big images while
 * the scene is off screen is enough). Without a handler a lost context is a
 * permanent blank: scroll the page and back, and the hero is gone. Reproduce it
 * with `gl.getExtension("WEBGL_lose_context").loseContext()`.
 *
 * The recovery, measured on a production site (a context-loss probe FAIL →
 * PASS, scroll and Lighthouse unchanged):
 *  1. `webglcontextlost` → `preventDefault()` (without it the browser never
 *     offers a restore) and mark the scene broken;
 *  2. when the scene nears the viewport, the tab returns, or the page comes
 *     back from the bfcache, a broken scene is **rebuilt on a fresh context**
 *     — at rest, no intro replay — rather than trusted in place (a restored
 *     context comes back with every *rendered* resource empty: environment
 *     maps, render targets);
 *  3. rebuilds are spaced (≥ 1 s) and a build that throws is retried a few
 *     times, so a device that keeps dropping contexts can't spin;
 *  4. every teardown releases its context at once (`releaseContext`), not at
 *     garbage collection — a rebuild otherwise holds two;
 *  5. optionally, while the scene is on screen, a once-a-second self-check
 *     asks whether it is still drawing: an event WebKit never sends (or sends
 *     during a rebuild) otherwise leaves the hero blank until the reader
 *     scrolls away and back.
 *
 * Also: never stop drawing a *visible* canvas on iOS — pause only off screen.
 * iOS drops the last frame after a toolbar resize, and a stopped scene never
 * repaints.
 *
 *   useEffect(() => keepSceneAlive({
 *     container: containerRef.current!,
 *     build: async ({ settled, onContextChange }) => {
 *       const scene = await createHeroScene(containerRef.current!, { skipIntro: settled });
 *       const stop = watchContext(scene.canvas, onContextChange);
 *       return {
 *         isBroken: () => scene.gl.isContextLost(),
 *         frames: () => scene.frameCount,
 *         dispose: () => { stop(); scene.dispose(); releaseContext(scene.gl); scene.canvas.remove(); },
 *       };
 *     },
 *   }), []);
 */

type GL = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * Listen for context loss and restore on `canvas`. `onChange` fires on either;
 * the loss is `preventDefault`ed so the browser may restore. Returns cleanup.
 */
export const watchContext = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  onChange: (event: "lost" | "restored") => void,
): (() => void) => {
  const lost = (event: Event) => {
    event.preventDefault();
    onChange("lost");
  };
  const restored = () => onChange("restored");
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
};

/**
 * Hand the GPU memory back now (three.js: `renderer.forceContextLoss()` does
 * the same). Safe on an already-lost context.
 */
export const releaseContext = (gl: GL | null | undefined): void => {
  if (!gl || gl.isContextLost()) return;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
};

export interface SceneHandle {
  /** The context is lost, or the scene otherwise can't draw. */
  isBroken(): boolean;
  /** Frames drawn so far — enables the on-screen self-check. Omit to skip it. */
  frames?(): number;
  /** Stop the loop, free GPU resources (`releaseContext`), remove the canvas. */
  dispose(): void;
}

export interface KeepSceneAliveOptions<H extends SceneHandle> {
  /** The scene's box — observed for proximity and visibility. */
  container: Element;
  /**
   * Build the scene. `settled` is true for a rebuild (skip the intro: the
   * reader already saw it). Wire `onContextChange` to `watchContext` on the
   * new canvas. May throw/reject when no context can be had.
   */
  build(context: { settled: boolean; onContextChange: () => void }): H | Promise<H>;
  /** How early to rebuild before the scene is back in view. */
  rootMargin?: string;
  /** Minimum time between two rebuilds. */
  gapMs?: number;
  /** Builds that may fail in a row before giving up for the visit. */
  maxFailures?: number;
  /** Self-check period while on screen (needs `handle.frames`); 0 disables. */
  watchMs?: number;
  /** Called when a build fails — e.g. show the still instead. */
  onFail?(error: unknown): void;
}

/** Build the scene and keep it alive. Returns the cleanup for the effect. */
export function keepSceneAlive<H extends SceneHandle>({
  container,
  build,
  rootMargin = "50% 0px",
  gapMs = 1000,
  maxFailures = 3,
  watchMs = 1000,
  onFail,
}: KeepSceneAliveOptions<H>): () => void {
  let current: H | null = null;
  let generation = 0;
  let building = false;
  let recheck = false;
  let failures = 0;
  let near = true;
  let inView = false;
  let cancelled = false;
  let lastBuild = Number.NEGATIVE_INFINITY;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let watchTimer: ReturnType<typeof setInterval> | undefined;
  let lastFrames = -1;
  let stalls = 0;

  const mount = (settled: boolean): void => {
    const mine = ++generation;
    current?.dispose();
    current = null;
    building = true;
    lastBuild = performance.now();
    Promise.resolve()
      .then(() =>
        build({
          settled,
          // A loss while still building is not dropped: re-checked on landing.
          onContextChange: () => {
            if (building) recheck = true;
            else if (near) ensureAlive();
          },
        }),
      )
      .then((handle) => {
        if (cancelled || mine !== generation) return handle.dispose();
        building = false;
        failures = 0;
        current = handle;
        if (recheck || handle.isBroken()) {
          recheck = false;
          if (near) ensureAlive();
        }
      })
      .catch((error: unknown) => {
        if (cancelled || mine !== generation) return;
        building = false;
        failures += 1;
        onFail?.(error);
      });
  };

  const ensureAlive = (): void => {
    if (cancelled || building) return;
    if (current && !current.isBroken()) return;
    if (!current && failures >= maxFailures) return;
    const wait = lastBuild + gapMs - performance.now();
    if (wait > 0) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => near && ensureAlive(), wait);
      return;
    }
    mount(true);
  };

  const watch = (): void => {
    if (cancelled || building || !inView || document.hidden || !current?.frames) return;
    const frames = current.frames();
    if (current.isBroken() || frames !== lastFrames) {
      lastFrames = frames;
      stalls = 0;
      if (current.isBroken()) ensureAlive();
      return;
    }
    // Two looks in a row without a new frame while on screen: rebuild.
    if (++stalls < 2) return;
    stalls = 0;
    lastFrames = -1;
    current.dispose();
    current = null;
    ensureAlive();
  };

  const nearby = new IntersectionObserver(
    ([entry]) => {
      near = entry.isIntersecting;
      if (near) ensureAlive();
    },
    { rootMargin },
  );
  const visible = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && watchMs > 0 && !watchTimer) {
      lastFrames = -1;
      stalls = 0;
      watchTimer = setInterval(watch, watchMs);
    } else if (!inView && watchTimer) {
      clearInterval(watchTimer);
      watchTimer = undefined;
    }
  });
  nearby.observe(container);
  visible.observe(container);

  const onReturn = (): void => {
    if (!document.hidden && near) ensureAlive();
  };
  document.addEventListener("visibilitychange", onReturn);
  window.addEventListener("pageshow", onReturn);

  mount(false);

  return () => {
    cancelled = true;
    nearby.disconnect();
    visible.disconnect();
    document.removeEventListener("visibilitychange", onReturn);
    window.removeEventListener("pageshow", onReturn);
    if (retryTimer) clearTimeout(retryTimer);
    if (watchTimer) clearInterval(watchTimer);
    current?.dispose();
    current = null;
  };
}
