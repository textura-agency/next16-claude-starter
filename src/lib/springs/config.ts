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
 *   value here so callers re-evaluate on resize. Falls back to `window.innerWidth`.
 */
export const isMobileDisabled = (value: boolean, viewportWidth?: number) => {
  if (typeof window === "undefined") return false;
  if (!value) return false;
  const width =
    viewportWidth && viewportWidth > 0 ? viewportWidth : window.innerWidth;
  return width <= springsConfig.mobileWidth;
};
