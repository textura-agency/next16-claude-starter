/**
 * @fileoverview Provides hooks for accessing and responding to window dimensions.
 * Contains three hooks:
 * - useWindowWidth: Returns current window width
 * - useWindowHeight: Returns current window height
 * - useWindowSize: Returns both width and height as an object
 *
 * All hooks:
 * - Are SSR-safe by checking for window existence
 * - Include debounced resize event handling
 * - Clean up event listeners on unmount
 * - Accept optional debounceDelay parameter (default 300ms)
 *
 * @param {number} [debounceDelay=300] - Delay in ms before resize handler fires
 * @returns {number|{width: number, height: number}} Window dimensions
 */

"use client";

import { debounce } from "@/utils/math";
import { useState, useEffect } from "react";

export function useWindowWidth(debounceDelay: number = 300): number {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = debounce(() => {
      setWindowWidth(window.innerWidth);
    }, debounceDelay);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [debounceDelay]);

  return windowWidth;
}

export function useWindowHeight(debounceDelay: number = 300): number {
  const [windowHeight, setWindowHeight] = useState<number>(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = debounce(() => {
      setWindowHeight(window.innerHeight);
    }, debounceDelay);

    window.addEventListener("resize", handleResize);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [debounceDelay]);

  return windowHeight;
}

export function useWindowSize(debounceDelay: number = 300): {
  width: number;
  height: number;
} {
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = debounce(() => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, debounceDelay);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [debounceDelay]);

  return windowSize;
}
