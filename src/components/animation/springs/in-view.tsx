// 📖 Docs: obsidian/frontend/components/animation-springs.md
/**
 * @fileoverview Inview animation component for scroll-based reveal animations
 *
 * This component provides spring animations triggered by scroll position:
 * 1. Configurable enter/exit animations
 * 2. Multiple animation modes (always, once, forward)
 * 3. Optional mobile device handling
 * 4. Support for external trigger elements
 *
 * @param {React.ReactNode} children - Child elements to animate
 * @param {boolean} enabled - Whether animations are enabled
 * @param {Object} from - Starting animation values
 * @param {Object} to - Ending animation values
 * @param {'always'|'once'|'forward'} mode - Animation mode:
 *   - always: Always animates when in view
 *   - once: Plays once when first in view
 *   - forward: Only plays forward
 * @param {React.CSSProperties} style - Additional CSS styles
 * @param {Object} config - Spring animation configuration
 * @param {number} delayIn - Delay before enter animation in ms
 * @param {number} delayOut - Delay before exit animation in ms
 * @param {string} innerClassName - Class name for inner animated element
 * @param {Tags} innerTag - HTML tag for inner animated element
 * @param {React.RefObject<HTMLElement>} trigger - Optional external trigger element ref
 * @param {boolean} disableOnMobile - Whether to disable on mobile devices
 * @param {boolean} immediateOut - Whether to skip exit animation
 */

"use client";

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
} from "react";
import { useDynamicInView } from "@/hooks/animation/use-dynamic-in-view";
import { Tags } from "@/types/springs";
import { isMobileDisabled, springsConfig } from "@/lib/springs/config";
import { useWindowWidth } from "@/hooks/use-window-size";
import { AnimatedVarTextTag } from "./animated-var-text-tag";

type SpringProps = {
  children?: React.ReactNode;
  enabled?: boolean;
  from?: Record<string, any>;
  to?: Record<string, any>;
  mode?: "always" | "once" | "forward";
  style?: React.CSSProperties;
  config?: Record<string, any>;
  delayIn?: number;
  delayOut?: number;
  innerClassName?: string;
  innerTag?: Tags;
  trigger?: React.RefObject<HTMLElement>;
  disableOnMobile?: boolean;
  immediateOut?: boolean;
} & React.HTMLAttributes<HTMLElement>;

export const Inview = forwardRef<HTMLElement, SpringProps & { tag?: Tags }>(
  (
    {
      tag: Tag = "div",
      children,
      from = {},
      to = {},
      mode = "always",
      style,
      config = {},
      delayIn = 0,
      delayOut = 0,
      enabled = true,
      innerTag,
      trigger,
      innerClassName,
      disableOnMobile = false,
      immediateOut = true,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLElement>(null);
    const [setInViewNode, inView] = useDynamicInView({
      trigger: trigger,
    });
    const isAnimated = useRef(false);
    const scrolledDown = useRef(false);
    const width = useWindowWidth();

    useImperativeHandle(ref, () => innerRef.current as HTMLElement);

    useEffect(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.inview || disableOnMobile,
          width,
        )
      ) {
        return;
      }
      if (mode === "forward") {
        const handleScroll = () => {
          if (innerRef.current) {
            const rect = innerRef.current.getBoundingClientRect();
            if (rect.top > 0) {
              scrolledDown.current = false;
            } else {
              scrolledDown.current = true;
            }
          }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
      }
    }, [mode, disableOnMobile, width]);

    const active = useMemo(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.inview || disableOnMobile,
          width,
        )
      ) {
        return false;
      }

      if (!enabled) {
        return false;
      }

      if (mode === "once" && isAnimated.current) {
        return true;
      }

      if (mode === "forward" && scrolledDown.current) {
        return true;
      }

      if (!isAnimated.current) {
        isAnimated.current = inView;
      }

      return inView;
    }, [inView, mode, enabled, disableOnMobile, width]);

    // Declarative spring — `useSpring` diffs values each render. The imperative
    // `useSpring(fn).api.start` form did not move the values in this project's
    // react-spring build.
    const springs = useSpring({
      from,
      to: active ? to : from,
      config,
      delay: active ? delayIn : delayOut,
      immediate: !active && immediateOut,
    });

    if (innerTag) {
      return (
        <AnimatedVarTextTag
          tag={Tag}
          ref={(node) => {
            innerRef.current = node as HTMLElement;
            setInViewNode(node);
          }}
          style={{ ...style }}
          {...props}
        >
          <AnimatedVarTextTag
            tag={innerTag}
            className={innerClassName}
            style={{ ...springs }}
          >
            {children}
          </AnimatedVarTextTag>
        </AnimatedVarTextTag>
      );
    }

    return (
      <AnimatedVarTextTag
        tag={Tag}
        ref={(node) => {
          innerRef.current = node as HTMLElement;
          setInViewNode(node);
        }}
        style={{ ...springs, ...style }}
        {...props}
      >
        {children}
      </AnimatedVarTextTag>
    );
  },
);

Inview.displayName = "Inview";
