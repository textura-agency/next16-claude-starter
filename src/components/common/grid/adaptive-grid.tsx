"use client";

// 📖 Docs: obsidian/frontend/components/common.md

import { useAdaptiveGrid } from "@/hooks/use-adaptive-grid";

import { GRID_BASE_WIDTH } from "./grid.config";

export interface AdaptiveGridProps {
  /**
   * Viewport width (px) above which the root font-size scales up.
   * Defaults to the largest grid breakpoint.
   */
  baseWidth?: number;
  /** Damping factor (0–1) for the scale-up; 1 = fully proportional. */
  coef?: number;
}

/**
 * Drives the adaptive scaling grid. Renders nothing — it only scales the root
 * font-size with the viewport. Mount once, near the app root.
 */
export const AdaptiveGrid = ({
  baseWidth = GRID_BASE_WIDTH,
  coef,
}: AdaptiveGridProps): null => {
  useAdaptiveGrid({ baseWidth, coef });
  return null;
};
