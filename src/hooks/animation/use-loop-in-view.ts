"use client";

/**
 * Custom hook that manages a render loop based on element visibility
 *
 * This hook creates a render loop that:
 * 1. Runs continuously while the element is in view
 * 2. When element goes out of view, continues rendering for 10 more frames
 *    to ensure proper cleanup and prevent abrupt stops
 * 3. Automatically restarts when element comes back into view
 *
 * @param ref - React ref for the element to observe
 * @param onRender - Callback function executed on each render frame
 * @param props - Optional loop configuration (framerate, mount/unmount handlers)
 */

import { useEffect, useRef } from "react";
import { useLoop, LoopProps } from "./use-render-loop";

export const useLoopInView = (
  ref: React.RefObject<HTMLDivElement>,
  onRender: (time: number) => void,
  props: LoopProps = {},
) => {
  const isInView = useRef(false);
  const renderCount = useRef(0);
  const shouldRender = useRef(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (isInView.current !== entry.isIntersecting) {
          if (!entry.isIntersecting) {
            renderCount.current = 0;
            shouldRender.current = true;
          }
        }
        isInView.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );

    if (ref.current) {
      observer.observe(ref.current);
      renderCount.current = 0;
      shouldRender.current = true;
    }

    return () => observer.disconnect();
  }, [ref]);

  useLoop((time) => {
    if (isInView.current || shouldRender.current) {
      onRender(time);

      if (!isInView.current) {
        renderCount.current++;
        if (renderCount.current >= 10) {
          shouldRender.current = false;
        }
      }
    }
  }, props);
};
