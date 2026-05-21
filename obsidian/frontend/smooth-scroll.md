---
tags: [frontend, scroll, stable]
updated: 2026-05-21
---

# Smooth Scroll — Lenis

Smooth scrolling is provided by **Lenis** (`^1.3.19`), integrated through
`ScrollLayout` and a Zustand store.

## Components & files

| File | Role |
|------|------|
| `src/layouts/scroll-layout.tsx` | `ScrollLayout` wrapper + `ScrollController` |
| `src/hooks/smooth-scroll/use-scroll.ts` | `useScroll` Zustand store |
| `src/utils/scroll-to.ts` | `scrollTo()` programmatic scroll helper |

## ScrollLayout

Wraps the whole app (mounted in `app/layout.tsx`). It splits into:

- A **server-safe shell** — renders `{children}` so content is SSR-friendly.
- `<ScrollController>` — a client-only, render-nothing component that owns Lenis.

`ScrollController` on mount:
1. Resets scroll to top.
2. Creates `new Lenis({ smoothWheel: true })`, stores it on `window.lenis` and in
   the [[data-flow|scroll store]].
3. Starts a `requestAnimationFrame` loop calling `lenis.raf(time)`.
4. Watches `isEnableScroll` — starts/stops Lenis and locks/unlocks native scroll
   (`html { overflow: hidden }`) accordingly.
5. Watches `pathname` for `#hash` → smooth-scrolls to the target after 300 ms.

`scrollSpeed` is an exported mutable `{ current: 1 }` — adjust to change global speed.

## The scroll store

```ts
import { useScroll } from "@/hooks/smooth-scroll/use-scroll";
import { useShallow } from "zustand/react/shallow";

const lenis = useScroll((s) => s.lenis);
const [start, stop] = useScroll(useShallow((s) => [s.start, s.stop]));
```

| Field | Type | Purpose |
|-------|------|---------|
| `lenis` | `Lenis \| null` | the live instance |
| `setLenis` | fn | setter (used by `ScrollController`) |
| `isEnableScroll` | `boolean` | is scrolling allowed |
| `start()` / `stop()` | fn | toggle scroll (e.g. lock when a modal opens) |

## Programmatic scrolling

```ts
import { scrollTo } from "@/utils/scroll-to";

scrollTo("#section-id", true);  // smooth scroll to an element id
scrollTo(0);                    // back to top
```

`scrollTo` temporarily disables scroll state during the animation when needed.

## Related

[[data-flow]] · [[system-overview]] · [[hooks]]
