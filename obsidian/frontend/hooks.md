---
tags: [frontend, stable]
updated: 2026-05-21
---

# Catalog — Hooks

Custom hooks in `src/hooks/`, grouped by domain.

## `hooks/animation/` — `#do-not-modify`

The hooks powering the [[animation-system]]. Consume them through the spring
components — don't call them directly unless extending the engine.

| Hook | File | Role |
|------|------|------|
| `useInViewRef` | `use-in-view-ref.ts` | IntersectionObserver ref for viewport detection |
| `useDynamicInView` | `use-dynamic-in-view.ts` | in-view detection with dynamic targets |
| `useLoopInView` | `use-loop-in-view.ts` | in-view tied to a render loop |
| `useProgressTrigger` | `use-progress-trigger.ts` | scroll → 0–1 progress (powers `<SpringTrigger>` / `<ProgressTrigger>`) |
| `useSpringTrigger` | `use-spring-trigger.ts` | scroll-driven spring logic |
| `useRenderLoop` | `use-render-loop.ts` | shared `requestAnimationFrame` loop |
| `useResizeLoop` | `user-resize-loop.ts` | resize observation loop |

## `hooks/smooth-scroll/`

| Hook | File | Role |
|------|------|------|
| `useScroll` | `use-scroll.ts` | Zustand store for Lenis + scroll state — see [[smooth-scroll]] |

## `hooks/` (root)

| Hook | File | Role |
|------|------|------|
| `useWindowWidth` / `useWindowHeight` / `useWindowSize` | `use-window-size.ts` | SSR-safe, debounced window dimensions (default 300 ms debounce) |

## Adding a hook

Place it under `hooks/<domain>/`. Data-fetching logic belongs in hooks, not in
presentational components. Use [[templates/hook-note]] to document it here.

## Related

[[animation-system]] · [[smooth-scroll]] · [[utils]]
