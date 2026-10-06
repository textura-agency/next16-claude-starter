// 📖 Docs: obsidian/frontend/webgl-scenes.md → "The iOS toolbar"

/**
 * A viewport height that does not follow the mobile browser's toolbar.
 *
 * iOS Safari collapses and expands its URL bar while the page scrolls: the
 * viewport's height changes, `resize` fires, `100dvh` / `fixed inset-0` boxes
 * change height, and a WebGL renderer that follows them reallocates its
 * drawing buffer (cleared → a blank frame) and re-renders — the scene flickers
 * on every scroll direction change (measured on 4 production sites; one also
 * re-randomised its physics on every resize, another went black for good).
 *
 * So a scene's box is sized to the **large** viewport (the toolbar collapsed),
 * measured once, and on touch devices it is re-measured only when the width
 * changes (a rotation). A desktop window still follows every resize.
 */

/** A phone or tablet: the devices whose toolbar moves with the scroll. */
export const isTouchViewport = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)));

/** The large viewport height in CSS px: `100lvh`, never less than `innerHeight`. */
const largeViewportHeight = (): number => {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const lvh = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.round(Math.max(lvh, window.innerHeight));
};

/** A rotation settles its height a beat after the first `resize`. */
const ROTATION_SETTLE_MS = 300;

let width = 0;
let height = 0;
let bound = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const publish = (nextHeight: number) => {
  if (nextHeight === height) return;
  height = nextHeight;
  listeners.forEach((listener) => listener());
};

const onResize = () => {
  const nextWidth = window.innerWidth;
  // A height-only change on a touch device is the toolbar: ignore it.
  if (isTouchViewport() && nextWidth === width) return;
  width = nextWidth;
  publish(largeViewportHeight());
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => publish(largeViewportHeight()), ROTATION_SETTLE_MS);
};

export const subscribeStableViewport = (listener: () => void): (() => void) => {
  if (!bound) {
    width = window.innerWidth;
    height = largeViewportHeight();
    window.addEventListener("resize", onResize, { passive: true });
    bound = true;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("resize", onResize);
    if (settleTimer) clearTimeout(settleTimer);
    bound = false;
  };
};

/** The locked height in CSS px (0 before the first subscriber). */
export const getStableViewportHeight = (): number => height;
