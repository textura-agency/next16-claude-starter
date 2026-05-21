---
tags: [frontend, animation, stable, do-not-modify]
updated: 2026-05-21
---

# Animation System

The core of this starter. **Every motion is spring-based** via `@react-spring/web`.
CSS transitions, CSS keyframes, and `framer-motion` are **banned**. ADR:
[[decisions-log]] ADR-0002.

> [!warning] #do-not-modify
> `src/components/animation/springs/` and `src/hooks/animation/` are the animation
> engine. Treat them as a vendored library — **consume them, don't edit them
> without explicit sign-off**. One authorized performance refactor has been made;
> see [[decisions-log]] ADR-0009.

## Shared render loop (ticker)

Every per-frame animation hook subscribes to **one** app-wide
`requestAnimationFrame` loop — `src/lib/animation/ticker.ts` (`subscribeToTicker`).
A page with N scroll-driven components runs **one** rAF, not N. The loop is
reference-counted: it starts on the first subscriber and stops when the last one
unmounts, so an idle page costs nothing.

- `useLoop` (and everything built on it — `useLoopInView`, `useResizeLoop`,
  `useSpringTrigger`, `useProgressTrigger`, `<AdaptiveGrid>`) goes through the
  ticker. Each subscriber keeps its own `framerate` throttle.
- Window dimensions (`useWindowWidth` / `useWindowHeight` / `useWindowSize`)
  share **one** debounced `resize` listener via a `useSyncExternalStore` store.

`src/lib/animation/ticker.ts` is **not** `#do-not-modify` — it is the supported
extension point for loop-based animation.

## The components

All live in `src/components/animation/springs/` and accept a `tag` prop so they
render the semantically correct HTML element. Full catalog:
[[components/animation-springs]].

| Component | Trigger | Use for |
|-----------|---------|---------|
| `<Inview>` | element enters viewport | fade/slide-in reveals |
| `<Spring>` | mount / enabled flag | unconditional spring animation |
| `<SpringTrigger>` | scroll progress | parallax, scrub, scroll-toggled motion |
| `<ProgressTrigger>` | scroll progress | raw 0–1 progress callback (no animation) |
| `<Hover>` | mouse enter/leave | hover effects (off on mobile) |
| `<Handle>` | content change | smooth enter/exit on children swap |
| `<AnimatedVarTextTag>` | — | low-level `animated[tag]` primitive |

For **text**, do not use these — use [[text-engine]].

## Choosing the right primitive

| Need | Component |
|------|-----------|
| Element fades/slides in when scrolled into view | `<Inview from={} to={} mode="once">` |
| Element moves continuously with scroll (parallax) | `<SpringTrigger mode="scrub">` |
| Element snaps to a state at a scroll point | `<SpringTrigger mode="toggle">` |
| Mouse hover animation | `<Hover from={} to={}>` |
| Just a 0–1 scroll progress value | `<ProgressTrigger onChange={}>` |
| Heading / copy reveal | `<TextEngine>` → [[text-engine]] |

## Common props

| Prop | Meaning |
|------|---------|
| `tag` | HTML element to render (`section`, `h1`, `div`…) — use the semantic one |
| `from` / `to` | spring start / end states — animatable CSS values only |
| `config` | `@react-spring/web` `SpringConfig` (`tension`, `friction`, …) |
| `mode` | trigger behaviour — varies per component (see below) |
| `delayIn` / `delayOut` | ms delay before enter / exit |
| `disableOnMobile` | respect the global mobile-disable config |
| `className` / `innerClassName` | Tailwind classes (kept separate from spring `style`) |

> Never pass Tailwind class names into `from`/`to`. Spring values are numbers or
> unit strings; classes go on `className`.

## Modes

- **`<Inview>` / `<Spring>`:** `"once"` (play once, stay), `"always"` (reverse on
  leave), `"forward"` (only on downward scroll).
- **`<SpringTrigger>`:** `"scrub"` (interpolate with scroll), `"toggle"` (snap at
  trigger point).

## Trigger positions (`start` / `end`)

Scroll components use a GSAP-style `TriggerPos` string:
`"<element-edge> <viewport-edge>"`, e.g. `"top bottom"`, `"center center"`,
`"bottom top-=100"`. Full grammar in [[text-engine]] (shared format).

## Global config

`src/lib/springs/config.ts`:

```ts
export const springsConfig = {
  mobileWidth: 768,
  disableOnMobile: {
    hover: true,        // always — no hover on mobile
    inview: false,
    spring: false,
    springtrigger: false,
  },
};
```

`isMobileDisabled(value, viewportWidth?)` checks the viewport against `mobileWidth`.
Pass a React-tracked width (e.g. from `useWindowWidth()`) as the second argument so
the check re-evaluates on resize; it falls back to `window.innerWidth` when omitted.
Components opt in per-instance via `disableOnMobile`. **Never disable animation
globally** — toggle per component when an animation hurts mobile UX.

## Underlying hooks

The components are built on `src/hooks/animation/` — also `#do-not-modify`. See
[[hooks]] for the catalog.

## Related

[[text-engine]] · [[components/animation-springs]] · [[data-flow]] · [[new-page]]
