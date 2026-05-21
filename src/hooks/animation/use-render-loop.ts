"use client";

/**
 * Custom hook that creates a render loop with configurable framerate
 *
 * This hook sets up a requestAnimationFrame loop that:
 * 1. Executes the provided render callback at the specified framerate
 * 2. Allows optional mount/unmount handlers
 * 3. Automatically cleans up when component unmounts
 *
 * @param onRender - Callback function executed on each render frame
 * @param props - Optional configuration object:
 *   - framerate: Minimum time (ms) between renders (default: 100ms)
 *   - onMount: Handler called when loop starts
 *   - onUnMount: Handler called when loop ends
 */

import { useEffect } from "react";

export interface LoopProps {
  onMount?: () => void;
  onUnMount?: () => void;
  framerate?: number;
}
export const useLoop = (
  onRender: (time: number) => void,
  props: LoopProps = {},
) => {
  useEffect(() => {
    let rq: any;
    let startTime = performance.now();
    props.onMount && props.onMount();
    render(0);
    function render(time: number) {
      if (time - startTime > (props.framerate || 100)) {
        onRender(time);
        startTime = performance.now();
      }
      rq = requestAnimationFrame(render);
    }
    return () => {
      cancelAnimationFrame(rq);
      props.onUnMount && props.onUnMount();
    };
  }, []);
};
