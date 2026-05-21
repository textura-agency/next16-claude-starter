/**
 * Shared animation ticker.
 *
 * A single, app-wide `requestAnimationFrame` loop. Every animation hook that
 * needs per-frame work subscribes here instead of starting its own rAF — so a
 * page with N scroll-driven components runs **one** loop, not N.
 *
 * The loop is reference-counted: it starts on the first subscriber and stops
 * (`cancelAnimationFrame`) when the last one leaves, so an idle page costs
 * nothing. Each subscriber is throttled independently by its own framerate.
 *
 * 📖 Docs: obsidian/frontend/animation-system.md
 */

export type TickerCallback = (time: number) => void;

interface Subscriber {
  callback: TickerCallback;
  /** Read live each frame so framerate prop changes take effect. */
  getFramerate: () => number;
  /** Timestamp of this subscriber's last invocation. */
  last: number;
}

const subscribers = new Set<Subscriber>();
let rafId: number | null = null;

const frame = (time: number): void => {
  // Snapshot first: a callback may subscribe/unsubscribe during iteration.
  for (const sub of [...subscribers]) {
    if (!subscribers.has(sub)) continue;
    if (time - sub.last <= sub.getFramerate()) continue;
    sub.last = time;
    try {
      sub.callback(time);
    } catch (error) {
      // Isolate failures — one bad subscriber must not kill the shared loop.
      console.error("[ticker] subscriber threw:", error);
    }
  }
  rafId = requestAnimationFrame(frame);
};

const start = (): void => {
  if (rafId === null) rafId = requestAnimationFrame(frame);
};

const stop = (): void => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

/**
 * Subscribe a callback to the shared rAF loop.
 *
 * @param callback - invoked with the rAF timestamp, no more often than `getFramerate()` ms apart.
 * @param getFramerate - returns the current minimum gap (ms) between invocations; read live every frame.
 * @returns an unsubscribe function.
 */
export const subscribeToTicker = (
  callback: TickerCallback,
  getFramerate: () => number,
): (() => void) => {
  const subscriber: Subscriber = {
    callback,
    getFramerate,
    last: performance.now(),
  };
  subscribers.add(subscriber);
  start();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) stop();
  };
};
