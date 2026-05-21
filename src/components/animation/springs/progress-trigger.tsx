// 📖 Docs: obsidian/frontend/components/animation-springs.md
/**
 * @fileoverview Progress trigger component for scroll-based progress tracking
 *
 * This component tracks scroll position relative to trigger points and fires progress updates:
 * 1. Configurable start and end trigger positions
 * 2. Provides normalized progress values (0-1)
 * 3. Supports external trigger elements
 * 4. Optional mobile device handling
 *
 * @param {React.ReactNode} children - Child elements
 * @param {boolean} enabled - Whether progress tracking is enabled
 * @param {React.RefObject<HTMLElement>} trigger - Optional external trigger element ref
 * @param {TriggerPos} start - Start position for trigger (e.g. "top bottom")
 * @param {TriggerPos} end - End    position for trigger (e.g. "bottom top")
 * @param {Function} onChange - Callback fired with progress updates
 * @param {boolean} disableOnMobile - Whether to disable on mobile devices
 * @param {SpringConfig} config - Spring animation configuration
 * @param {number} frameInterval - Frame rate throttle interval in ms
 * @param {Tags} tag - HTML tag to use for container
 */

"use client";

import { CSSProperties, forwardRef, useImperativeHandle, useRef } from "react";
import { SpringConfig, config } from "@react-spring/web";
import { Tags } from "@/types/springs";
import { useProgressTrigger } from "@/hooks/animation/use-progress-trigger";

const VarTextTag = forwardRef<HTMLElement, { tag?: Tags; children?: React.ReactNode; className?: string; style?: CSSProperties; [key: string]: any }>(
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

export type TriggerPos =
  | "top top"
  | "center top"
  | "bottom top"
  | "top center"
  | "center center"
  | "bottom center"
  | "top bottom"
  | "center bottom"
  | "bottom bottom";

type ProgressTriggerProps = {
  children?: React.ReactNode;
  enabled?: boolean;
  trigger?: React.RefObject<HTMLElement> | undefined;
  start?: TriggerPos;
  end?: TriggerPos;
  onChange?: (state: {
    progress: number;
    interpolatedProgress: number;
  }) => void;
  disableOnMobile?: boolean;
  config?: SpringConfig;
  frameInterval?: number;
} & Omit<React.HTMLAttributes<HTMLElement>, "onChange">;

export const ProgressTrigger = forwardRef<
  HTMLElement,
  ProgressTriggerProps & { tag?: Tags }
>(
  (
    {
      tag: Tag = "div",
      children,
      start = "top bottom",
      end = "bottom top",
      trigger = undefined,
      onChange,
      enabled = true,
      disableOnMobile = false,
      frameInterval = 10,
      config: springConfig = config.default,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLElement);

    useProgressTrigger({
      start,
      end,
      trigger,
      onChange,
      enabled,
      disableOnMobile,
      frameInterval,
      config: springConfig,
      elementRef: innerRef,
    });

    if (trigger && Tag === undefined) {
      return <>{children}</>;
    }

    return (
      <VarTextTag tag={Tag} ref={innerRef} {...props}>
        {children}
      </VarTextTag>
    );
  },
);

ProgressTrigger.displayName = "ProgressTrigger";
