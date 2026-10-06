"use client";

// 📖 Docs: obsidian/frontend/robot-form.md

import { createElement, forwardRef, type ComponentProps } from "react";

import { Hover as MotionHover } from "@/components/animation/springs/hover";

import { restStyle } from "./robot-spring";
import { useRobot } from "./robot-view";

type HoverProps = ComponentProps<typeof MotionHover>;

/**
 * The engine's `<Hover>`, except on the robot form: there it renders
 * the plain element at its `from` state — a robot never hovers, so the hover
 * rests un-hovered, with no spring controller and no listeners to hydrate.
 * People get the engine's `<Hover>` unchanged. Swap an import to this file;
 * the vendored engine is untouched.
 */
export const Hover = forwardRef<HTMLElement, HoverProps>(
  function RobotAwareHover(props, ref) {
    const robot = useRobot();
    if (!robot) return <MotionHover ref={ref} {...props} />;
    const {
      tag = "div",
      children,
      from,
      to: _to,
      config: _config,
      delayIn: _delayIn,
      delayOut: _delayOut,
      enabled: _enabled,
      trigger: _trigger,
      disableOnMobile: _disableOnMobile,
      immediateOut: _immediateOut,
      style,
      ...rest
    } = props;
    return createElement(
      tag as string,
      { ...rest, ref, style: restStyle(from, style) },
      children,
    );
  },
);
