/**
 * @fileoverview Hooks for accessing and responding to window dimensions.
 *
 * - useWindowWidth: current window width
 * - useWindowHeight: current window height
 * - useWindowSize: both width and height
 *
 * All three read from a **single shared store**: one debounced `resize`
 * listener is attached for the whole app (on the first mounted consumer) and
 * removed when the last consumer unmounts — instead of one listener + one
 * debounce timer per hook call. State is delivered through
 * `useSyncExternalStore`, so it is SSR-safe and tear-free.
 */

"use client";

import { useSyncExternalStore } from "react";

/** Debounce applied to the single shared `resize` listener (ms). */
const DEBOUNCE_MS = 300;

interface WindowSize {
  width: number;
  height: number;
}

/** Stable snapshot returned during SSR / before the window is measured. */
const SERVER_SNAPSHOT: WindowSize = { width: 0, height: 0 };

const measure = (): WindowSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

// Initialised eagerly on the client so the first render already has real
// values (no post-mount re-render); falls back to the server snapshot in SSR.
let snapshot: WindowSize =
  typeof window !== "undefined" ? measure() : SERVER_SNAPSHOT;

const listeners = new Set<() => void>();
let resizeBound = false;
let debounceId: ReturnType<typeof setTimeout> | undefined;

const publish = (): void => {
  const next = measure();
  if (next.width === snapshot.width && next.height === snapshot.height) return;
  snapshot = next; // new reference only on a real change — keeps snapshots stable
  listeners.forEach((listener) => listener());
};

const handleResize = (): void => {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(publish, DEBOUNCE_MS);
};

const subscribe = (listener: () => void): (() => void) => {
  if (!resizeBound) {
    snapshot = measure();
    window.addEventListener("resize", handleResize, { passive: true });
    resizeBound = true;
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("resize", handleResize);
      if (debounceId) clearTimeout(debounceId);
      resizeBound = false;
    }
  };
};

export function useWindowSize(): WindowSize {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
}

export function useWindowWidth(): number {
  return useSyncExternalStore(
    subscribe,
    () => snapshot.width,
    () => SERVER_SNAPSHOT.width,
  );
}

export function useWindowHeight(): number {
  return useSyncExternalStore(
    subscribe,
    () => snapshot.height,
    () => SERVER_SNAPSHOT.height,
  );
}
