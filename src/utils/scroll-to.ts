/**
 * @fileoverview Utility function for smooth scrolling to elements or positions
 * Handles both scrolling to element IDs and numeric positions
 * Temporarily disables scroll state during animation if scroll is enabled
 */

//if lenis
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
//endif

export const scrollTo = (id?: string | number, immediate?: boolean) => {
  //if lenis
  const isEnabled = useScroll.getState().isEnableScroll;
  //endif

  if (typeof id === "string") {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    //if lenis
    if (isEnabled) {
      useScroll.setState({ isEnableScroll: false });
    }
    //endif

    setTimeout(() => {
      window.scrollTo({
        top: getDistanceFromTop(el),
        behavior: immediate ? "instant" : "smooth",
      });
    }, 50);
  } else {
    setTimeout(() => {
      window.scrollTo({
        top: Number(id) || 0,
        behavior: immediate ? "instant" : "smooth",
      });
    }, 50);
  }

  if (isEnabled) {
    setTimeout(() => {
      useScroll.setState({ isEnableScroll: true });
    }, 100);
  }

  function getDistanceFromTop(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return rect.top + scrollTop;
  }
};
