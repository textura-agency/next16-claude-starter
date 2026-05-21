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
    const [inViewRef, inView] = useDynamicInView({
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
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
      }
    }, [mode, disableOnMobile, width]);

    const active = useMemo(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.inview || disableOnMobile,
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

    const [springs, api] = useSpring(() => ({
      ...from,
      config,
    }));

    useEffect(() => {
      if (
        isMobileDisabled(
          springsConfig.disableOnMobile.inview || disableOnMobile,
        )
      ) {
        return;
      }
      if (active) {
        api.start({ ...to, config, delay: delayIn });
      } else {
        api.start({
          ...from,
          config,
          delay: delayOut,
          immediate: immediateOut,
        });
      }
    }, [active, api, to, from, config, delayIn, delayOut, immediateOut]);

    if (innerTag) {
      return (
        <AnimatedVarTextTag
          tag={Tag}
          ref={(node) => {
            innerRef.current = node as HTMLElement;
            inViewRef.current = node as HTMLElement;
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
          inViewRef.current = node as HTMLElement;
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
