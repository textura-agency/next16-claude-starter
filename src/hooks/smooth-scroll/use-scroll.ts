import Lenis from "lenis";
import { create } from "zustand";

export interface UseScroll {
  lenis: Lenis | null;
  setLenis: (lenis: Lenis | null) => void;
  isEnableScroll: boolean;
  start: () => void;
  stop: () => void;
}

export const useScroll = create<UseScroll>((set) => ({
  lenis: null,
  setLenis: (lenis) => set({ lenis }),
  isEnableScroll: true,
  start: () => set({ isEnableScroll: true }),
  stop: () => set({ isEnableScroll: false }),
}));
