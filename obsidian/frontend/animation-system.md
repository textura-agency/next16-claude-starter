---
tags: [frontend, animation, stable, do-not-modify]
updated: 2026-10-06
---

# Animation System

The core of this starter. **Every motion is spring-based** via `@react-spring/web`.
CSS keyframes and `framer-motion` are **banned**. ADR: [[decisions-log]] ADR-0002.

> [!note] One narrow CSS exception (ADR-0014)
> CSS `transition-*` is allowed for **simple, discrete state changes only** —
> hover/focus colour, opacity, border, underline, small decorative nudges — with
> token-backed timing (`duration-[var(--duration-fast)] ease-entrance`). Anything
> scroll-driven, revealing, layout-affecting, staggered, or interruptible is a
> spring. `@keyframes` stay banned. Rules and examples: [[design-system#Motion: springs first, CSS for trivial state]].

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
| Mouse hover animation — physical, or animating transforms | `<Hover from={} to={}>` |
| Hover/focus **colour, opacity or border** change only | plain CSS `transition-*` (ADR-0014) — no component |
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
A tracked width of **0** (the server snapshot `useWindowWidth()` returns during
hydration) answers `false`, like the server — it used to fall back to
`window.innerWidth`, so on a phone a render that hid an element differed from
the server HTML (React #418, the whole root re-rendered: a 453 ms task on a
production site). The real width arrives on the next render. In your own
components, only let `isMobileDisabled` decide **markup** with a tracked width;
in effects and handlers either form is fine.
Components opt in per-instance via `disableOnMobile`. **Never disable animation
globally** — toggle per component when an animation hurts mobile UX.

## Loops and motion off — the freeze

Reduced motion (`<ReducedMotion>`) and the robot form ([[robot-form]]) both
switch on react-spring's global `skipAnimation`. Under it a **looping spring**
finishes each lap in 0 ms and starts the next in the same tick, forever — the
page hangs. Seen live on 6+ production sites (frozen on load or on hover for
reduced-motion visitors; Lighthouse `PAGE_HUNG` on the robot form; at best
~300 ms of main thread per load). *Rule.*

```tsx
import { useMotionOff } from "@/hooks/use-motion-off";

const motionOff = useMotionOff();
const pulse = useSpring({ from: { o: 0.4 }, to: { o: 1 }, loop: !motionOff });
```

- `useMotionOff()` is correct on the **first** render (it reads the media
  query in a state initialiser) — react-spring's `useReducedMotion()` alone is a
  render too late: the loop has already started.
- The same applies to `while (alive) { await api.start(…) }` loops — stop the
  loop when `motionOff`, and wait on a timer between laps.
- Test with reduced motion emulated and on the robot form: the page must stay
  responsive (`page.evaluate(() => 1)` returns).

## `<Spring mode="once">` fed by an in-view flag replays

`Spring`'s `active` returns `false` on `!enabled` **before** it checks `once`,
so `<Spring mode="once" enabled={inView}>` hides again when it leaves the
viewport and replays on return. Latch in the caller (never in the engine):

```tsx
const [seen, setSeen] = useState(false);
useEffect(() => { if (inView) setSeen(true); }, [inView]);
<Spring mode="once" enabled={seen} …>
```

`<Inview mode="once">` tracks its own observer and is fine.

## Per-frame work outside the engine

Hand-written rAF loops, canvas and WebGL: scale every step by the frame's
duration in seconds (`src/lib/scene/per-frame.ts`), never a fixed phone frame
cap, write per-frame styles only on change and on the smallest element (a CSS
variable on `<html>` written every frame restyled 571 elements, 10–22 ms per
frame on a phone). See [[webgl-scenes]].

The ticker's per-subscriber `framerate` is a **minimum gap** between calls — a
budget throttle. A `framerate` of `1000 / 30` draws ~20 fps on a 60 Hz screen;
don't use it to cap a visible scene.

## Underlying hooks

The components are built on `src/hooks/animation/` — also `#do-not-modify`. See
[[hooks]] for the catalog.

## Related

[[text-engine]] · [[components/animation-springs]] · [[robot-form]] · [[webgl-scenes]] · [[data-flow]] · [[new-page]]
