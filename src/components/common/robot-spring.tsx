"use client";

// 📖 Docs: obsidian/frontend/robot-form.md

import {
  createElement,
  forwardRef,
  type ComponentProps,
  type CSSProperties,
} from "react";

import { Spring as MotionSpring } from "@/components/animation/springs/spring";

import { useRobot } from "./robot-view";

type SpringProps = ComponentProps<typeof MotionSpring>;

/** react-spring's transform shorthands, folded into one CSS `transform`. */
const TRANSFORM = new Set(["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "rotateZ"]);
const px = (v: unknown) => (typeof v === "number" ? `${v}px` : String(v));
const deg = (v: unknown) => (typeof v === "number" ? `${v}deg` : String(v));

/** The spring's resting values as static CSS — the element exactly at `to`. */
export const restStyle = (to: Record<string, unknown> = {}, style?: CSSProperties): CSSProperties => {
  const out: Record<string, unknown> = { ...style };
  const parts: string[] = [];
  for (const [key, value] of Object.entries(to)) {
    if (!TRANSFORM.has(key)) {
      out[key] = value;
      continue;
    }
    if (key === "x") parts.push(`translateX(${px(value)})`);
    else if (key === "y") parts.push(`translateY(${px(value)})`);
    else if (key === "z") parts.push(`translateZ(${px(value)})`);
    else if (key.startsWith("scale")) parts.push(`${key}(${String(value)})`);
    else parts.push(`${key}(${deg(value)})`);
  }
  if (parts.length) out.transform = parts.join(" ");
  return out as CSSProperties;
};

/**
 * The engine's `<Spring>`, except on the robot form: there it renders
 * the plain element at its `to` state — no spring, no controller, nothing to
 * hydrate but the element. People get the engine's `<Spring>` unchanged.
 * Swap an import to this file; the vendored engine is untouched.
 */
export const Spring = forwardRef<HTMLElement, SpringProps>(function RobotAwareSpring(props, ref) {
  const robot = useRobot();
  if (!robot) return <MotionSpring ref={ref} {...props} />;
  const {
    tag = "div",
    children,
    from,
    to,
    mode,
    config: _config,
    delayIn: _delayIn,
    delayOut: _delayOut,
    enabled,
    disableOnMobile: _disableOnMobile,
    immediateOut: _immediateOut,
    style,
    ...rest
  } = props;
  // An entrance reveal rests at `to`. A UI toggle (`mode="always"`, driven by
  // `enabled` — a menu, an accordion) rests where its state says: closed menus
  // stay closed (a phone menu otherwise renders open on the robot form).
  // `mode` defaults to "always" in the engine, so an unset mode is a toggle
  // too (a modal with `enabled={isOpen}` and no mode otherwise renders open).
  const resting = (mode ?? "always") === "always" && enabled === false ? from : to;
  return createElement(tag as string, { ...rest, ref, style: restStyle(resting, style) }, children);
});
