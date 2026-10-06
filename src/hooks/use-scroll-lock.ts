"use client";

// 📖 Docs: obsidian/frontend/smooth-scroll.md → "One-screen pages"

import { useEffect } from "react";

import { useScroll } from "@/hooks/smooth-scroll/use-scroll";

/**
 * Lock the page scroll while `locked` is true — a one-screen layout, an open
 * menu, a modal.
 *
 * Lenis drives the scroll position itself, so `body { overflow: hidden }` does
 * NOT stop the wheel on a Lenis page (a one-screen design could be wheeled
 * ~140 px on a fresh desktop load). This goes through the scroll store, which
 * stops Lenis and locks native scroll together, and restores both on unlock.
 * `toTop` scrolls to the top on locking — a one-screen layout entered after a
 * scroll would otherwise stay offset.
 */
export const useScrollLock = (locked: boolean, { toTop = false } = {}) => {
  const stop = useScroll((s) => s.stop);
  const start = useScroll((s) => s.start);
  const lenis = useScroll((s) => s.lenis);

  useEffect(() => {
    if (!locked) return;
    if (toTop) {
      lenis?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    }
    stop();
    return () => start();
  }, [locked, toTop, lenis, stop, start]);
};
