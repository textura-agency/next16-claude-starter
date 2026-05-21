"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { scrollTo } from "@/utils/scroll-to";
import { useShallow } from "zustand/react/shallow";

export const scrollSpeed = { current: 1 };

export function ScrollLayout({ children }: { children: React.ReactNode }) {
  // Server-safe rendering
  return (
    <div className="scroll-layout">
      {/* Static content that can be rendered on server */}
      <div className="scroll-layout-content">{children}</div>

      {/* Client-only functionality */}
      <ScrollController />
    </div>
  );
}

function ScrollController() {
  const isEnableScroll = useScroll((state) => state.isEnableScroll);
  const [hash, setHash] = useState<string>("");
  const [lenis, setLenis] = useScroll(
    useShallow((state) => [state.lenis, state.setLenis]),
  );
  const pathname = usePathname();
  const savedPathname = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const lenis = new Lenis({
      smoothWheel: true,
      // syncTouch: true,
    });
    (window as typeof window & { lenis: Lenis }).lenis = lenis;
    setLenis(lenis);

    const raf = (time: number) => {
      lenis?.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      setLenis(null);
    };
  }, [setLenis]);

  useEffect(() => {
    if (isEnableScroll) {
      lenis?.start();
      enableNativeScroll(true);
    } else {
      lenis?.stop();
      enableNativeScroll(false);
    }
  }, [isEnableScroll, lenis]);

  useEffect(() => {
    if (lenis && hash) {
      setTimeout(() => {
        scrollTo(hash, true);
      }, 300);
    }
  }, [lenis, hash]);

  useEffect(() => {
    if (savedPathname.current !== pathname) {
      savedPathname.current = pathname;
      if (pathname.includes("#")) {
        const hash = pathname.split("#").pop();
        if (hash) {
          setHash(hash);
        }
      }
    }
  }, [pathname, setHash]);

  return null; // This component doesn't render anything visible
}

const enableNativeScroll = (value: boolean) => {
  if (typeof document === "undefined") return;
  if (!document) return;
  const html = document.querySelector("html");
  if (!html) return;
  if (!value) {
    html.style.position = "relative";
    html.style.overflow = "hidden";
    html.style.height = "100%";
  } else {
    html.style.removeProperty("position");
    html.style.removeProperty("overflow");
    html.style.removeProperty("height");
  }
};
