"use client";

/**
 * Custom hook that runs a callback on a render loop with a configurable framerate.
 *
 * This hook subscribes the callback to the shared animation ticker
 * (`src/lib/animation/ticker.ts`) — a single app-wide `requestAnimationFrame`
 * loop — instead of starting its own rAF. It:
 * 1. Executes the provided render callback at (most) the specified framerate
 * 2. Allows optional mount/unmount handlers
 * 3. Automatically unsubscribes when the component unmounts
 *
 * `onRender` and `framerate` are read live through refs, so prop changes take
 * effect without re-subscribing (and without the stale-closure bug a captured
 * callback would cause).
 *
 * @param onRender - Callback function executed on each render frame
 * @param props - Optional configuration object:
 *   - framerate: Minimum time (ms) between renders (default: 100ms)
 *   - onMount: Handler called when the loop subscription starts
 *   - onUnMount: Handler called when the loop subscription ends
 */

import { useEffect, useRef } from "react";

import { subscribeToTicker } from "@/lib/animation/ticker";

export interface LoopProps {
  onMount?: () => void;
  onUnMount?: () => void;
  framerate?: number;
}

const DEFAULT_FRAMERATE = 100;

export const useLoop = (
  onRender: (time: number) => void,
  props: LoopProps = {},
) => {
  const onRenderRef = useRef(onRender);
  const propsRef = useRef(props);

  // Keep the live values reachable from the mount-only subscription below.
  useEffect(() => {
    onRenderRef.current = onRender;
    propsRef.current = props;
  });

  useEffect(() => {
    propsRef.current.onMount?.();

    const unsubscribe = subscribeToTicker(
      (time) => onRenderRef.current(time),
      () => propsRef.current.framerate ?? DEFAULT_FRAMERATE,
    );

    return () => {
      unsubscribe();
      propsRef.current.onUnMount?.();
    };
    // Mount-only: live values are read through refs above.
  }, []);
};
