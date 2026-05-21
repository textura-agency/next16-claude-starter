"use client";

/**
 * Custom hook that provides both a ref for intersection observation and a ref containing the current view state
 *
 * This hook:
 * 1. Uses react-spring's useInView hook to observe element visibility
 * 2. Maintains a ref that always contains the current visibility state
 * 3. Returns both the element ref and the state ref for flexible usage
 *
 * @returns {[React.RefObject<HTMLElement>, React.MutableRefObject<boolean>]}
 * Tuple containing:
 * - ref: Reference to attach to observed element
 * - inViewRef: Reference containing current visibility state
 */

import { useInView } from "@react-spring/web";
import { useEffect, useRef } from "react";

export const useInViewRef = () => {
  const [ref, inView] = useInView();
  const inViewRef = useRef(inView);
  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);
  return [ref, inViewRef];
};
