"use client";

// 📖 Docs: obsidian/frontend/robot-form.md

import { Globals } from "@react-spring/web";
import { createContext, useContext, useLayoutEffect } from "react";

/**
 * The robot form of the page: every spring and text-engine animation jumps to
 * its end state, and `useRobot()` lets components render at rest in the served
 * HTML (see `robot-spring.tsx`, `robot-inview.tsx`, `robot-hover.tsx`,
 * `robot-text.tsx`).
 *
 * The form is marked by the server: `<RobotView>` renders
 * `<meta name="x-robot-view">`, and `isRobotView()` reads that rather than the
 * URL — the proxy *rewrites*, so the address bar still says `/` (a pathname
 * check never fires). People's pages never carry the tag.
 */
export const isRobotView = (): boolean =>
  typeof document !== "undefined" &&
  document.querySelector('meta[name="x-robot-view"]') !== null;

// `skipAnimation` is set at module evaluation — before anything on the page
// mounts — and again in a layout effect, because the root `ReducedMotion`
// re-assigns it from the OS setting when it mounts.
if (isRobotView()) {
  window.__robotView = true;
  Globals.assign({ skipAnimation: true });
}

const RobotContext = createContext(false);

/** True inside `<RobotProvider robot>` — the robot form of the view. */
export const useRobot = (): boolean => useContext(RobotContext);

export const RobotProvider = ({
  robot,
  children,
}: {
  robot: boolean;
  children: React.ReactNode;
}) => <RobotContext.Provider value={robot}>{children}</RobotContext.Provider>;

/** Render once, in the robot form of a view only. */
export const RobotView = () => {
  useLayoutEffect(() => {
    window.__robotView = true;
    Globals.assign({ skipAnimation: true });
  }, []);
  return <meta name="x-robot-view" content="1" />;
};
