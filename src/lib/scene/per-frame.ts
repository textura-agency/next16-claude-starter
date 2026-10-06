// 📖 Docs: obsidian/frontend/webgl-scenes.md → "Frame rate and time"

/**
 * Frame-rate-independent motion for render loops (WebGL scenes, canvas
 * effects, any hand-written rAF loop).
 *
 * Phones run at 120 Hz (ProMotion iPhones, most Android flagships), laptops at
 * 60–120 Hz, a busy phone drops to 30. A loop that moves things by a fixed
 * amount **per frame** runs at a different speed on each — twice as fast at
 * 120 Hz, and 4× when two loops tick it (a worker loop + a page loop). Every
 * per-frame step must be scaled by the frame's duration, in **seconds**.
 *
 *   const clock = createFrameClock();
 *   function frame(now: number) {
 *     const { dt, t } = clock.tick(now);           // seconds
 *     x += (target - x) * perFrame(0.08, dt);      // was: x += (target - x) * 0.08
 *     angle += SPEED_PER_60HZ_FRAME * dt * 60;     // was: angle += SPEED_PER_60HZ_FRAME
 *     material.uniforms.uTime.value = t;           // was: performance.now() (ms!)
 *   }
 *
 * One clock, in seconds, for every path that draws the scene: a scene moved
 * into an OffscreenCanvas worker once received its time in milliseconds where
 * the page path passed seconds — every timed motion ran ~1000× fast, aliased
 * into jitter ("2–4× too fast and shaking"). No lab metric sees speed:
 * Lighthouse and scroll tests count frames, not pixels per second.
 */

/** The longest step a frame may take — a tab coming back must not teleport. */
export const MAX_FRAME_DT = 0.1;

/**
 * The fraction of the gap a per-frame ease `k` (authored at 60 fps) closes over
 * `dt` seconds: `x += (target - x) * perFrame(k, dt)` feels at every frame rate
 * the way `x += (target - x) * k` felt at 60 fps.
 */
export const perFrame = (k: number, dt: number): number =>
  1 - Math.pow(1 - k, Math.max(0, dt) * 60);

/**
 * Exponential damping toward `target` with a rate in 1/s — the time-based
 * form of the same ease (`lambda` ≈ 60·k for small k).
 */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => current + (target - current) * (1 - Math.exp(-lambda * dt));

export interface FrameClock {
  /**
   * Call once per frame with the rAF timestamp (ms). Returns `dt`, the clamped
   * step since the last frame, and `t`, the time since the first frame — both
   * in seconds.
   */
  tick(nowMs: number): { dt: number; t: number };
  /** Forget the last frame (after a pause) so the next `dt` is 0, not the pause. */
  reset(): void;
}

/** One time source in seconds, shared by every path that draws the scene. */
export const createFrameClock = (): FrameClock => {
  let first = -1;
  let last = -1;
  return {
    tick(nowMs) {
      if (first < 0) first = nowMs;
      const dt = last < 0 ? 0 : Math.min(MAX_FRAME_DT, (nowMs - last) / 1000);
      last = nowMs;
      return { dt: Math.max(0, dt), t: (nowMs - first) / 1000 };
    },
    reset() {
      last = -1;
    },
  };
};

/**
 * Desktop draw gate: 12.5 ms sits between a 120 Hz (8.3 ms) and a 60 Hz
 * (16.7 ms) tick, so a 60 Hz screen draws every frame and a 120 Hz one every
 * other. Desktop WebGL scenes redrawing at 120 Hz were the steady scroll-drop
 * cause on several production sites (rule); gating the draw at ~60 fps made
 * desktop scroll ideal. Gate the DRAW only — keep easing every tick (scaled by
 * `dt`). **Never on phones**: a fixed phone frame cap reads as choppy on a
 * 120 Hz iPhone and can trip a scene's own fps → DPR fallback.
 */
export const DESKTOP_DRAW_GATE_MS = 12.5;

export interface DrawGate {
  /** Call every tick with the frame's `dt` (s); true when this tick should draw. */
  shouldDraw(dt: number): boolean;
  /** Draw on the next tick regardless (a resize, a state change, a rebuild). */
  force(): void;
}

/**
 * `const gate = createDrawGate(isDesktop)` — then in the loop, after easing:
 * `if (gate.shouldDraw(dt)) renderer.render(scene, camera)`. With
 * `enabled = false` (phones, tablets) it draws every tick.
 */
export const createDrawGate = (
  enabled: boolean,
  intervalMs: number = DESKTOP_DRAW_GATE_MS,
): DrawGate => {
  let since = Infinity;
  return {
    shouldDraw(dt) {
      if (!enabled) return true;
      since += dt * 1000;
      if (since < intervalMs) return false;
      since = 0;
      return true;
    },
    force() {
      since = Infinity;
    },
  };
};
