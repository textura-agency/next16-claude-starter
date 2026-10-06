/**
 * @fileoverview Configuration file for Spring animation components
 *
 * Global configuration for all Spring components.
 * Controls behavior and features across the entire application.
 *
 * disableOnMobile: Controls which spring animations are disabled on mobile devices
 * - hover: Disable hover animations on mobile (default: true since no hover on mobile)
 * - inview: Disable in-view animations on mobile
 * - spring: Disable basic spring animations on mobile
 * - springtrigger: Disable scroll-triggered animations on mobile
 */
interface SpringsConfig {
  mobileWidth: number;
  disableOnMobile: {
    hover: boolean;
    inview: boolean;
    spring: boolean;
    springtrigger: boolean;
  };
}

export const springsConfig: SpringsConfig = {
  mobileWidth: 768,
  disableOnMobile: {
    hover: true,
    inview: false,
    spring: false,
    springtrigger: false,
  },
} as const;

/**
 * @param value - whether the animation opts into mobile-disabling
 * @param viewportWidth - optional explicit width (px); pass a React-tracked
 *   value here so callers re-evaluate on resize. Omitted (event handlers) →
 *   `window.innerWidth`.
 *
 * A tracked width of **0** means "not measured yet": `useWindowWidth()`
 * returns its server snapshot (0) during hydration. That must answer like the
 * server (`false`), never fall back to `window.innerWidth` — on a phone the
 * fallback made a render that hides an element differ from the server HTML
 * (React #418, the whole root re-rendered: a 453 ms task measured on a
 * production site). The real width arrives on the next render.
 */
export const isMobileDisabled = (value: boolean, viewportWidth?: number) => {
  if (typeof window === "undefined") return false;
  if (!value) return false;
  if (viewportWidth === 0) return false;
  const width = viewportWidth ?? window.innerWidth;
  return width <= springsConfig.mobileWidth;
};
