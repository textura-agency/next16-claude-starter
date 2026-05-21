// 📖 Docs: obsidian/frontend/components/animation-springs.md
/**
 * @fileoverview Spring-based trigger component for scroll-driven animations
 *
 * @param {React.ReactNode} children - Child elements to animate
 * @param {boolean} enabled - Whether animations are enabled
 * @param {React.RefObject<HTMLElement>} trigger - Optional external trigger element ref
 * @param {TriggerPos} start - Start position configuration for trigger
 * @param {TriggerPos} end - End position configuration for trigger
 * @param {Function} onChange - Callback fired with animation progress
 * @param {Object} from - Starting animation values
 * @param {Object} to - Ending animation values
 * @param {boolean} disableOnMobile - Whether to disable on mobile devices
 * @param {SpringConfig} config - Spring animation configuration
 * @param {number} frameInterval - Frame rate throttle interval in ms
 * @param {Tags} innerTag - HTML tag for inner animated element
 * @param {string} innerClassName - Class name for inner animated element
 * @param {"toggle"|"scrub"} mode - Animation mode:
 *   - toggle: Snaps between states
 *   - scrub: Smoothly interpolates between states
 */

"use client";

import { animated, config, easings, SpringConfig } from "@react-spring/web";
import {
  CSSProperties,
  ElementType,
  forwardRef,
  memo,
  useImperativeHandle,
  useRef,
} from "react";
import { Tags } from "@/types/springs";
import { useSpringTrigger } from "@/hooks/animation/use-spring-trigger";
import { TriggerPos } from "@/components/animation/springs/progress-trigger";

type ProgresstriggerProps = {
  children?: React.ReactNode;
  enabled?: boolean;
  trigger?: React.RefObject<HTMLElement> | undefined;
  start?: TriggerPos;
  end?: TriggerPos;
  onChange?: (state: {
    progress: number;
    interpolatedProgress: number;
  }) => void;
  from?: { [x: string]: string | number };
  to?: { [x: string]: string | number };
  disableOnMobile?: boolean;
  config?: SpringConfig;
  frameInterval?: number;
  innerTag?: Tags;
  innerClassName?: string;
  mode?: "toggle" | "scrub";
} & Omit<React.HTMLAttributes<HTMLElement>, "onChange">;

export interface VarTextTagProps {
  tag?: Tags;
  children?: React.ReactNode;
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

const VarTextTag = forwardRef<HTMLElement, VarTextTagProps>(
  ({ tag = "span", children, className, style, ...props }, outerRef) => {
    const ref = useRef<HTMLElement | null>(null);
    useImperativeHandle(outerRef, () => ref.current as HTMLElement);
    const Tag = tag as unknown as React.ElementType;
    return (
      <Tag ref={ref} className={className} style={style} {...props}>
        {children}
      </Tag>
    );
  },
);
VarTextTag.displayName = "VarTextTag";

export const SpringTrigger = memo(
  forwardRef<HTMLElement, ProgresstriggerProps & { tag?: Tags }>(
    (
      {
        tag: Tag = "div",
        children,
        start = "top bottom",
        end = "bottom top",
        trigger,
        from = {},
        to = {},
        onChange,
        enabled = true,
        disableOnMobile = false,
        frameInterval = 10,
        innerTag = "div",
        innerClassName,
        config: springConfig = { duration: 1, easing: easings.linear },
        mode = "scrub",
        ...props
      },
      ref,
    ) => {
      const innerRef = useRef<HTMLElement>(null);
      useImperativeHandle(ref, () => innerRef.current as HTMLElement);

      const { springs } = useSpringTrigger({
        start,
        end,
        trigger,
        from,
        to,
        onChange,
        enabled,
        disableOnMobile,
        frameInterval,
        config: springConfig,
        mode,
        elementRef: innerRef,
      });

      if (trigger && Tag === undefined) {
        return <>{children}</>;
      }

      return (
        <VarTextTag tag={Tag} ref={innerRef} {...props}>
          <AnimatedVarTextTag
            tag={innerTag}
            style={springs}
            className={innerClassName}
          >
            {children}
          </AnimatedVarTextTag>
        </VarTextTag>
      );
    },
  ),
);

SpringTrigger.displayName = "SpringTrigger";
