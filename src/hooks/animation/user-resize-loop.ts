"use client";

/**
 * Custom hook that executes a callback when window width changes
 *
 * This hook:
 * 1. Sets up a render loop that checks window width on each frame
 * 2. Only triggers the callback when width actually changes
 * 3. Maintains previous width in a ref to detect changes
 * 4. Supports optional loop configuration via props
 *
 * @param onResize - Callback function executed when width changes
 * @param props - Optional loop configuration (framerate, mount/unmount handlers)
 */

import { useRef } from "react";
import { LoopProps, useLoop } from "./use-render-loop";

export const useResizeLoop = (
  onResize: (time: number) => void,
  props?: LoopProps,
) => {
  const width = useRef(0);
  useLoop((time: number) => {
    if (width.current !== window.innerWidth) {
      onResize && onResize(time);
      width.current = window.innerWidth;
    }
  }, props);
};
