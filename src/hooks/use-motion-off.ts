"use client";

// 📖 Docs: obsidian/frontend/animation-system.md → "Loops and motion off"

import { useState } from "react";
import { useReducedMotion } from "@react-spring/web";

import { useRobot } from "@/components/common/robot-view";

const reducedAtStart = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True when motion is off: the visitor prefers reduced motion, or this is the
 * robot form. **Every looping spring must read it** — `loop: !motionOff` — and
 * every `while (alive) { await … }` spring loop must stop on it, because both
 * conditions switch on react-spring's global `skipAnimation`, under which a
 * loop finishes each lap instantly and starts the next in the same tick: the
 * page freezes (a hung page on load, measured on 6+ production sites; ~300 ms
 * of main thread per load at best).
 *
 * The media query is read on the first render: `useReducedMotion()` alone
 * reports `false` until its effect runs, by which time the loop has started.
 * The flag doesn't touch the DOM, so reading it during render can't mismatch.
 */
export const useMotionOff = (): boolean => {
  const [reducedFirst] = useState(reducedAtStart);
  const reduced = Boolean(useReducedMotion());
  const robot = useRobot();
  return reducedFirst || reduced || robot;
};
