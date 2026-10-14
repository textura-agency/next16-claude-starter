---
tags: [frontend, animation, stable, do-not-modify]
updated: 2026-10-14
---

# Catalog — Spring Components

Files in `src/components/animation/springs/`. The animation engine — `#do-not-modify`.
Conceptual overview: [[animation-system]].

All components accept `tag` (semantic HTML element), `className`, and react-spring
`config`. Each is `"use client"`.

Prop types (`src/types/springs.ts`): `from` / `to` are `SpringStyle`
(`Record<string, string | number>`), `config` is react-spring's `SpringConfig`,
`trigger` is a `TriggerRef` (`RefObject<HTMLElement | null>`), `tag` is `Tags`.
No `any` — typed with sign-off in ADR-0030 (types only, no behaviour change).

## `<Inview>` — `in-view.tsx`

Springs `from` → `to` when the element enters the viewport (IntersectionObserver).

- `mode`: `"once"` (play once, stay) · `"always"` (reverse on leave) · `"forward"`
  (only on downward scroll).
- `delayIn` / `delayOut`, `immediateOut`, `disableOnMobile`.
- `trigger` — optional external element to observe. Omit it and the component
  observes its own rendered element (the common case).
- `innerTag` / `innerClassName` — the inner animated wrapper.

## `<Spring>` — `spring.tsx`

Unconditional spring driven by mount / the `enabled` flag. Same `mode` set as
`<Inview>`. Use when motion shouldn't depend on the viewport.

## `<SpringTrigger>` — `spring-trigger.tsx`

Scroll-progress animation between two trigger points.

- `mode`: `"scrub"` (continuously interpolate with scroll — parallax, progress bars)
  · `"toggle"` (snap between `from`/`to` at the trigger point).
- `start` / `end` — `TriggerPos` strings (see [[text-engine]]).
- `trigger` — optional external scroll-reference element.
- `onChange({ progress, interpolatedProgress })` callback.
- `frameInterval` — throttle for the scroll handler.

## `<ProgressTrigger>` — `progress-trigger.tsx`

Tracks scroll position and emits a normalised **0–1 progress** value via
`onChange` — no animation of its own. Use to drive custom logic.

## `<Hover>` — `hover.tsx`

Spring on mouse enter/leave. Disabled on mobile by default (`disableOnMobile.hover`
is always `true`). `trigger` lets a different element fire the hover.

> [!note] Not every hover needs this (ADR-0014)
> A hover that only changes **colour, opacity, or border** is plain CSS —
> `transition-colors duration-[var(--duration-fast)] ease-entrance
> hover:text-foreground` — and needs no component at all. Reach for `<Hover>`
> when the motion is physical or interruptible, animates transforms, or must be
> driven from another element via `trigger`. See
> [[design-system#Motion: springs first, CSS for trivial state]].

## `<Handle>` — `handle.tsx`

Smooth enter/exit when `children` change — caches previous content during the
transition. Configurable `from`/`to`, `delayIn`/`delayOut`, `enabled`, and
`tag` (rendered since 2026-10-14 — it used to be ignored; default `div`).

## `<AnimatedVarTextTag>` — `animated-var-text-tag.tsx`

Low-level primitive: renders `animated[tag]` with a forwarded ref. Building block
for the other components — rarely used directly.

## Related

[[animation-system]] · [[hooks]] · [[components/common]]
