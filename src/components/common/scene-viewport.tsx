"use client";

// 📖 Docs: obsidian/frontend/webgl-scenes.md → "The iOS toolbar"

import { useSyncExternalStore, type ReactNode } from "react";

import { getStableViewportHeight, subscribeStableViewport } from "@/utils/stable-viewport";

const serverHeight = () => 0;

/**
 * A full-bleed, fixed box for a WebGL scene that does not resize while a
 * phone scrolls (see `utils/stable-viewport.ts`): `100lvh` from the first
 * paint, then a px height that a touch device only re-measures on a width
 * change (rotation). Use it instead of `fixed inset-0` / `h-dvh` around a
 * canvas:
 *
 *   <SceneViewport className="-z-10"><canvas ref={canvasRef} className="size-full" /></SceneViewport>
 *
 * The renderer inside must follow the same rule: resize only when its box's
 * size really changed (skip a same-size resize), and draw at once after a real
 * one — a reallocated buffer is blank until the next draw.
 */
export const SceneViewport = ({ className, children }: { className?: string; children: ReactNode }) => {
  const height = useSyncExternalStore(subscribeStableViewport, getStableViewportHeight, serverHeight);
  return (
    <div
      className={`fixed inset-x-0 top-0 h-lvh ${className ?? ""}`}
      style={height > 0 ? { height } : undefined}
    >
      {children}
    </div>
  );
};
