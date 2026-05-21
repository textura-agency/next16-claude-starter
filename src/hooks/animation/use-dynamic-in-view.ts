"use client";

/**
 * Custom hook that dynamically observes element visibility and handles ref changes
 *
 * This hook:
 * 1. Creates an IntersectionObserver to track element visibility
 * 2. Supports both direct refs and trigger refs for observation
 * 3. Uses a Proxy to efficiently track ref changes
 * 4. Maintains both immediate and ref-based visibility states
 * 5. Provides callbacks for enter/leave visibility events
 *
 * Key features:
 * - Proxy-based ref tracking
 * - Configurable observer options
 * - Enter/leave event callbacks
 * - Synchronized state refs
 * - Automatic cleanup
 *
 * @param {IntersectionObserverOptions} options - Configuration object containing:
 *   - root: Root element for intersection observation
 *   - rootMargin: Margin around the root
 *   - threshold: Intersection ratio thresholds
 *   - onEnter: Callback when element enters viewport
 *   - onLeave: Callback when element leaves viewport
 *   - trigger: Optional external ref to observe instead of internal ref
 *
 * @returns {[MutableRefObject<HTMLElement | null>, boolean, MutableRefObject<boolean>]}
 * Tuple containing:
 * - targetRef: Ref to attach to observed element
 * - inView: Current visibility state
 * - inViewRef: Reference containing current visibility state
 */
// TODO: test this hook

import { RefObject, useEffect, useRef, useState } from "react";

interface IntersectionObserverOptions {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
  onEnter?: (entry: IntersectionObserverEntry) => void;
  onLeave?: (entry: IntersectionObserverEntry) => void;
  trigger?: RefObject<HTMLElement | HTMLDivElement | null>;
}

export const useDynamicInView = (
  options: IntersectionObserverOptions = {},
): [RefObject<HTMLElement | null>, boolean, RefObject<boolean>] => {
  const targetRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const inViewRef = useRef(inView);

  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);

  useEffect(() => {
    const innerRef = options.trigger || targetRef;

    // Create proxy to track ref changes
    const refProxy = new Proxy(innerRef, {
      set(target, prop, value) {
        const result = Reflect.set(target, prop, value);
        if (prop === "current" && value) {
          const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                options?.onEnter?.(entry);
                setInView(true);
              } else {
                options?.onLeave?.(entry);
                setInView(false);
              }
            });
          }, options);

          observer.observe(value);
        }
        return result;
      },
    });

    // Initial setup if ref already has value
    if (refProxy.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            options?.onEnter?.(entry);
            setInView(true);
          } else {
            options?.onLeave?.(entry);
            setInView(false);
          }
        });
      }, options);

      observer.observe(refProxy.current);
      return () => observer.disconnect();
    }
  }, [options]);

  return [targetRef, inView, inViewRef];
};
