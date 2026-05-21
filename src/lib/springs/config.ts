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

export const isMobileDisabled = (value: boolean) => {
  if (typeof window === "undefined") return false;
  if (value) {
    if (window.innerWidth <= springsConfig.mobileWidth) {
      return true;
    }
  }
  return false;
};
