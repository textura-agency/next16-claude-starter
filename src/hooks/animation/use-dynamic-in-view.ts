"use client";

/**
 * Custom hook that observes an element's viewport visibility.
 *
 * This hook:
 * 1. Creates a single IntersectionObserver for the observed element
 * 2. Observes either an external `trigger` ref or the element attached via the
 *    returned callback ref
 * 3. Re-creates the observer only when the observed element or observer options
 *    actually change — not on every render
 * 4. Exposes visibility as both reactive state and a synchronous ref
 * 5. Disconnects the observer automatically on cleanup
 *
 * @param {IntersectionObserverOptions} options - Configuration object containing:
 *   - root: Root element for intersection observation
 *   - rootMargin: Margin around the root
 *   - threshold: Intersection ratio thresholds
 *   - onEnter: Callback when element enters viewport
 *   - onLeave: Callback when element leaves viewport
 *   - trigger: Optional external ref to observe instead of the attached element
 *
 * @returns {[TargetRefCallback, boolean, RefObject<boolean>]} Tuple of:
 * - targetRef: callback ref — attach it to the element to observe
 * - inView: current visibility state (reactive)
 * - inViewRef: ref mirroring the current visibility state (synchronous reads)
 */

import { RefObject, useEffect, useRef, useState } from "react";

interface IntersectionObserverOptions {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
  onEnter?: (entry: IntersectionObserverEntry) => void;
  onLeave?: (entry: IntersectionObserverEntry) => void;
  trigger?: RefObject<HTMLElement | HTMLDivElement | null>;
}

type TargetRefCallback = (node: HTMLElement | null) => void;

export const useDynamicInView = (
  options: IntersectionObserverOptions = {},
): [TargetRefCallback, boolean, RefObject<boolean>] => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const inViewRef = useRef(false);

  const { trigger, root, rootMargin, threshold, onEnter, onLeave } = options;

  // Hold the callbacks in refs so changing them never re-creates the observer.
  const onEnterRef = useRef(onEnter);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onEnterRef.current = onEnter;
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    const target = trigger?.current ?? node;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry.isIntersecting;
        inViewRef.current = intersecting;
        setInView(intersecting);
        if (intersecting) {
          onEnterRef.current?.(entry);
        } else {
          onLeaveRef.current?.(entry);
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [node, trigger, root, rootMargin, threshold]);

  return [setNode, inView, inViewRef];
};
