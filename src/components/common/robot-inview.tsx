"use client";

// 📖 Docs: obsidian/frontend/robot-form.md

import { createElement, forwardRef, type ComponentProps } from "react";

import { Inview as MotionInview } from "@/components/animation/springs/in-view";

import { restStyle } from "./robot-spring";
import { useRobot } from "./robot-view";

type InviewProps = ComponentProps<typeof MotionInview>;

/**
 * The engine's `<Inview>`, except on the robot form: there it renders
 * the plain element at its `to` state — no in-view observer, no spring, nothing
 * to hydrate but the element (and its `innerTag` wrapper, when it has one).
 * People get the engine's `<Inview>` unchanged. Swap an import to this file;
 * the vendored engine is untouched.
 */
export const Inview = forwardRef<HTMLElement, InviewProps>(function RobotAwareInview(props, ref) {
  const robot = useRobot();
  if (!robot) return <MotionInview ref={ref} {...props} />;
  const {
    tag = "div",
    children,
    from: _from,
    to,
    mode: _mode,
    config: _config,
    delayIn: _delayIn,
    delayOut: _delayOut,
    enabled: _enabled,
    trigger: _trigger,
    disableOnMobile: _disableOnMobile,
    immediateOut: _immediateOut,
    innerTag,
    innerClassName,
    style,
    ...rest
  } = props;
  if (innerTag)
    return createElement(
      tag as string,
      { ...rest, ref, style },
      createElement(innerTag as string, { className: innerClassName, style: restStyle(to) }, children),
    );
  return createElement(tag as string, { ...rest, ref, style: restStyle(to, style) }, children);
});
