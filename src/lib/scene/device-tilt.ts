// 📖 Docs: obsidian/frontend/webgl-scenes.md → "Device tilt"

/**
 * Device tilt for a hero model on phones — the gyroscope as a cursor.
 *
 * A module-level singleton, not React state: a scene reads `readTilt()` inside
 * its own frame loop (r3f `useFrame`, a raw rAF, a worker message on change),
 * so nothing re-renders and nothing runs when no scene asks.
 *
 *   startTilt()              once, from the scene's mount effect (client only); → live?
 *   const t = readTilt(dt)   per frame: { x, y } in [-1, 1], eased, dt in s
 *   stopTilt()               on unmount
 *
 * Sources, in order:
 *  1. `deviceorientation` — listened to from the start. Android Chrome sends
 *     it freely (https). iOS 13+ sends nothing until
 *     `DeviceOrientationEvent.requestPermission()` is called inside a user
 *     gesture: the first `touchend` / `click` asks (Safari shows its own
 *     "Allow motion & orientation" sheet); an ask rejected for want of a
 *     gesture (a scroll's touchend) re-arms for the next one. Declined or
 *     unsupported → source 3.
 *  2. The reading is relative to how the phone was held at the first sample
 *     (baseline), so a phone held at 45° reads 0 — and it re-centres slowly,
 *     so a visitor who changes grip doesn't leave the model stuck at an edge.
 *  3. Idle sway — a slow Lissajous drift (±0.35) so the model is never dead
 *     before permission, without it, or on a laptop with no sensor.
 * Off (always 0) for the robot form and `prefers-reduced-motion`; only on
 * coarse pointers — a mouse keeps the scene's own pointer code.
 *
 * SEO/perf: no DOM, no render, no network; listeners are passive and added
 * after mount. The robot form never calls `startTilt()`.
 */

import { isRobotView } from "@/components/common/robot-view";

type Tilt = { x: number; y: number };

const RANGE_DEG = 22; // tilt that reaches ±1
const EASE = 6; // 1/s — exp(-EASE·dt) smoothing of the target
const RECENTRE = 0.15; // 1/s — baseline drifts toward the current pose

let started = 0;
let active = false;
let hasSensor = false;
let base: { b: number; g: number } | null = null;
let raw: Tilt = { x: 0, y: 0 };
const out: Tilt = { x: 0, y: 0 };
let clock = 0;
let lastT = 0;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

const screenAngle = (): number =>
  (typeof screen !== "undefined" && screen.orientation?.angle) ||
  (typeof window !== "undefined" && typeof (window as { orientation?: number }).orientation === "number"
    ? ((window as { orientation?: number }).orientation as number)
    : 0);

function onOrientation(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  hasSensor = true;
  // Map to screen axes: in landscape, beta and gamma swap.
  const a = screenAngle();
  let b = e.beta;
  let g = e.gamma;
  if (a === 90) [b, g] = [g, -b];
  else if (a === -90 || a === 270) [b, g] = [-g, b];
  if (!base) base = { b, g };
  const now = performance.now();
  const dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0;
  lastT = now;
  const k = 1 - Math.exp(-RECENTRE * dt);
  base.b += (b - base.b) * k;
  base.g += (g - base.g) * k;
  raw = { x: clamp((g - base.g) / RANGE_DEG), y: clamp((b - base.b) / RANGE_DEG) };
}

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

function disarm() {
  removeEventListener("touchend", askOnce);
  removeEventListener("click", askOnce);
}

function askOnce() {
  if (hasSensor) return disarm(); // already streaming (Chrome exposes the API but needs no grant)
  const api = (globalThis as { DeviceOrientationEvent?: PermissionApi }).DeviceOrientationEvent;
  const ask = api?.requestPermission?.();
  if (!ask) return disarm();
  disarm();
  ask
    // The listener is already on (see startTilt); "granted" just lets iOS send.
    .then((s) => { if (s !== "granted") hasSensor = false; })
    // Rejected = not a user activation (e.g. the touchend that ended a scroll):
    // ask again on the next gesture rather than giving up for the visit.
    .catch(() => { if (active) arm(); });
}

function arm() {
  addEventListener("touchend", askOnce, { passive: true });
  addEventListener("click", askOnce, { passive: true });
}

/**
 * Reduced motion, or the robot form (`components/common/robot-view.tsx` sets
 * `window.__robotView` and serves `<meta name="x-robot-view">`).
 */
const motionOff = (): boolean =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  window.__robotView === true ||
  isRobotView();

/** Returns whether tilt is live (a phone, motion allowed) — a caller can skip its own loop. */
export function startTilt(): boolean {
  if (typeof window === "undefined") return false;
  if (started++ > 0) return active;
  if (motionOff() || !matchMedia("(pointer: coarse)").matches) return false;
  active = true;
  // Listening asks for nothing: Android Chrome streams at once; iOS stays
  // silent until granted. No prompt on load either way.
  addEventListener("deviceorientation", onOrientation, { passive: true });
  const api = (globalThis as { DeviceOrientationEvent?: PermissionApi }).DeviceOrientationEvent;
  // iOS: ask inside the first gesture; a rejected ask (no activation) re-arms.
  if (typeof api?.requestPermission === "function") arm();
  return true;
}

export function stopTilt(): void {
  if (typeof window === "undefined" || --started > 0) return;
  started = 0;
  active = false;
  removeEventListener("deviceorientation", onOrientation);
  disarm();
  base = null;
  lastT = 0;
  hasSensor = false;
  raw = { x: 0, y: 0 };
}

/** Per frame. `dt` in seconds. Returns the same object — read, don't keep. */
export function readTilt(dt: number): Readonly<Tilt> {
  if (!active) return out;
  clock += dt;
  const target = hasSensor
    ? raw
    : { x: Math.sin(clock * 0.45) * 0.35, y: Math.sin(clock * 0.31 + 1.3) * 0.2 };
  const k = 1 - Math.exp(-EASE * dt);
  out.x += (target.x - out.x) * k;
  out.y += (target.y - out.y) * k;
  return out;
}
