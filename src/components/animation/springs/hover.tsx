// 📖 Docs: obsidian/frontend/components/animation-springs.md
/**
 * @fileoverview Hover animation component for mouse interaction animations
 *
 * This component provides spring-based hover animations:
 * 1. Configurable enter/exit animations on hover
 * 2. Optional mobile device handling
 * 3. Support for external trigger elements
 * 4. Customizable spring configurations
 *
 * @param {React.ReactNode} children - Child elements to animate
 * @param {boolean} enabled - Whether animations are enabled
 * @param {Object} from - Starting animation values
 * @param {Object} to - Ending animation values
 * @param {React.CSSProperties} style - Additional CSS styles
 * @param {Object} config - Spring animation configuration
 * @param {number} delayIn - Delay before enter animation in ms
 * @param {number} delayOut - Delay before exit animation in ms
 * @param {React.RefObject<HTMLElement>} trigger - Optional external trigger element ref
 * @param {boolean} disableOnMobile - Whether to disable on mobile devices
 * @param {boolean} immediateOut - Whether to skip exit animation
 * @param {Tags} tag - HTML tag to use for container
 */

"use client";

import React from "react";
import { animated, useSpring } from "@react-spring/web";
import {
  CSSProperties,
  ElementType,
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tags } from "@/types/springs";
import { isMobileDisabled, springsConfig } from "@/lib/springs/config";
import { useWindowWidth } from "@/hooks/use-window-size";

type SpringProps = {
  children?: React.ReactNode;
  enabled?: boolean;
  from?: Record<string, any>;
  to?: Record<string, any>;
  style?: React.CSSProperties;
  config?: Record<string, any>;
  delayIn?: number;
  delayOut?: number;
  trigger?: React.RefObject<any>;
  disableOnMobile?: boolean;
  immediateOut?: boolean;
} & React.HTMLAttributes<HTMLElement>;

export interface VarTextTagProps {
  tag?: Tags;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}
const AnimatedVarTextTag = forwardRef<HTMLElement, VarTextTagProps>(
  ({ tag = "span", children, className, style, ...props }, outerRef) => {
    const ref = useRef<HTMLElement | null>(null);
    useImperativeHandle(outerRef, () => ref.current as HTMLElement);
    const Tag = animated[tag] as ElementType;

    return (
      <Tag ref={ref} className={className} style={style} {...props}>
        {children}
      </Tag>
    );
  },
);
AnimatedVarTextTag.displayName = "AnimatedVarTextTag";

export const Hover = forwardRef<HTMLElement, SpringProps & { tag?: Tags }>(
  (
    {
      tag: Tag = "div",
      children,
      from = {},
      to = {},
      style,
      config = {},
      delayIn = 0,
      delayOut = 0,
      enabled = true,
      trigger,
      disableOnMobile = true,
      immediateOut = false,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLElement>(null);
    const [hovered, setHovered] = useState(false);
    const width = useWindowWidth();

    useImperativeHandle(ref, () => innerRef.current as HTMLElement);

    useEffect(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.hover || disableOnMobile,
          width,
        )
      ) {
        return;
      }

      // Snapshot the node so the cleanup detaches from the same element the
      // effect attached to, even if `trigger.current` changes later.
      const node = trigger?.current;
      if (!node) {
        return;
      }
      const handleMouseEnter = () => {
        setHovered(true);
      };
      const handleMouseLeave = () => {
        setHovered(false);
      };
      node.addEventListener("mouseenter", handleMouseEnter);
      node.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        node.removeEventListener("mouseenter", handleMouseEnter);
        node.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, [trigger, disableOnMobile, width]);

    const handleMouseEnter = () => {
      if (
        isMobileDisabled(springsConfig.disableOnMobile.hover || disableOnMobile)
      ) {
        return;
      }
      if (trigger?.current) {
        return;
      }
      setHovered(true);
    };

    const handleMouseLeave = () => {
      if (
        isMobileDisabled(springsConfig.disableOnMobile.hover || disableOnMobile)
      ) {
        return;
      }
      if (trigger?.current) {
        return;
      }
      setHovered(false);
    };

    const active = useMemo(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.hover || disableOnMobile,
          width,
        )
      ) {
        return false;
      }
      if (!enabled) {
        return false;
      }

      return hovered;
    }, [enabled, hovered, disableOnMobile, width]);

    // Declarative spring — `useSpring` diffs values each render, so it
    // reliably animates to `to` while hovered and back to `from` otherwise.
    // The imperative `useSpring(fn).api.start` form did not move the values in
    // this project's react-spring build.
    const springs = useSpring({
      from,
      to: active ? to : from,
      config,
      delay: active ? delayIn : delayOut,
      immediate: !active && immediateOut,
    });

    return (
      <AnimatedVarTextTag
        ref={innerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        tag={Tag}
        style={{ ...springs, ...style }}
        {...props}
      >
        {children}
      </AnimatedVarTextTag>
    );
  },
);

Hover.displayName = "Hover";
