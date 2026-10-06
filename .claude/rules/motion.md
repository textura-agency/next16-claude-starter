---
paths:
  - "src/components/**/*.tsx"
  - "src/views/**/*.tsx"
  - "src/layouts/**/*.tsx"
description: Motion rules — springs only, with one narrow CSS exception
---

# Motion in this project

Full note: `obsidian/frontend/animation-system.md` · `obsidian/frontend/text-engine.md`

- **All real motion is spring-based** — `@react-spring/web` via
  `src/components/animation/springs/`. Text animates through `spring-text-engine`.
- **Banned:** `@keyframes`, `framer-motion`, GSAP, any other animation library.
- **The only CSS exception** (ADR-0014): `transition-*` utilities for simple
  discrete state changes — hover/focus colour, opacity, border, a few-px nudge.
  All three conditions must hold, or it is a spring:
  1. token-backed timing — `duration-[var(--duration-fast)] ease-entrance`
  2. `transition-*` only, never `@keyframes`
  3. lives in `className`, never in a CSS file

  `duration-fast` as a bare class does **nothing** — Tailwind v4 has no
  `--duration-*` namespace. Always `duration-[var(--duration-fast)]`.

## Picking a primitive

| Need | Component |
|------|-----------|
| Reveal on scroll-into-view | `<Inview mode="once">` |
| Continuous scroll motion (parallax, progress) | `<SpringTrigger mode="scrub">` |
| Snap at a scroll point | `<SpringTrigger mode="toggle">` |
| Hover | `<Hover>` |
| Heading / copy reveal | `spring-text-engine` — see the text-engine note |

## TextEngine traps

- **Never `mode="manual"`** — use `always` / `once` / `forward` / `progress`.
- Its container is **flex**: `text-center` alone will not centre it — pair with
  `justify-center` on the tag.
- `overflow` clips to the line-height box: keep leading ≥ 1.1 (`leading-display`).
  `leading-none` + `overflow` shaves glyphs.

## Loops and motion off — the freeze (rule, 6+ production sites)

Reduced motion and the robot form both switch on react-spring's global
`skipAnimation`. Under it a looping spring finishes each lap in 0 ms and starts
the next in the same tick — **the page hangs** (Lighthouse `PAGE_HUNG`, a live
page frozen on load or on hover for reduced-motion visitors).

- Every `loop:` spring reads `useMotionOff()` (`@/hooks/use-motion-off`):
  `loop: !motionOff`. Every `while (alive) { await spring.start(…) }` loop
  stops on it too. `useReducedMotion()` alone is a render too late.
- Test: `page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])`
  and the robot form (`curl -A Googlebot` / a bot UA) — the page must respond.

## `<Spring mode="once" enabled={inView}>` replays (engine order)

The engine's `Spring` checks `!enabled` before `once`, so a once-spring fed by
an in-view flag hides again when it leaves the viewport. Latch it in the caller,
never in the engine: `const [seen, setSeen] = useState(false)` +
`useEffect(() => { if (inView) setSeen(true) }, [inView])`, `enabled={seen}`.
(`<Inview mode="once">` tracks its own observer and is fine.)

## Per-frame code (rAF loops, canvas, WebGL)

Full note: `obsidian/frontend/webgl-scenes.md`

- Scale every per-frame step by the frame's duration in **seconds**:
  `perFrame(k, dt)` / `damp()` from `@/lib/scene/per-frame` — a bare `x += (t - x) * k`
  runs 2× fast at 120 Hz.
- **No fixed phone frame cap** (rule, 5+ sites): a `t - last < 1000 / 30`
  budget throttle draws 20 fps on 60 Hz and ~26 on 120 Hz — on a real phone it reads as
  "low fps". Pay with a cheaper frame (DPR, samples, particles). A cap truly
  needed → skip alternate frames (`frame % 2`), never a budget throttle.
- Write per-frame styles only on change, on the smallest element; never a CSS
  variable on `<html>` per frame (restyles the whole page).

Every animation component takes `tag` — pass the semantic element, never `div`.
Tailwind classes go on `className` / `innerClassName`, never into spring `from`/`to`.
