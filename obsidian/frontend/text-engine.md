---
tags: [frontend, animation, stable]
updated: 2026-05-21
---

# Text Engine — `spring-text-engine`

All **text animation** is handled by the `spring-text-engine` package (`^0.1.5`).
**Do not build custom text-animation components.** For non-text motion see
[[animation-system]].

- Package: `spring-text-engine` · peer dep `@react-spring/web`
- Playground & docs: [textengine.textura.agency](https://textengine.textura.agency)
- Full API reference: [[text-engine-reference]]

## Import

```tsx
import TextEngine from 'spring-text-engine';
import { tengine } from 'spring-text-engine';            // factory pattern
import type { TextEngineInstance } from 'spring-text-engine';
```

## How it works

`TextEngine` splits `children` into **letter / word / line** slots and drives each
with an independent spring. Mixed children work — plain strings animate alongside
`<span>`, `<strong>`, icons, SVGs.

Nested layers (only rendered when their `*In` prop is set):

```
wrapLine → line → wrapWord → word → wrapLetter → letter
```

Each layer has an `In` (enter) and `Out` (resting/exit) target. Set `Out` to the
hidden resting state, `In` to the visible destination.

## Modes

| Mode | Behaviour |
|------|-----------|
| `"always"` *(default)* | Plays in on enter, out on leave. Repeats. |
| `"once"` | Plays in once, never replays. |
| `"forward"` | Plays in on downward scroll only. |
| `"manual"` | Imperative — `instance.playIn()` etc. **Avoid in this project.** |
| `"progress"` | Driven by scroll between `start`/`end`. Sub-modes `toggle` / `interpolate`. |

> [!important] Project rule
> **NEVER use `mode="manual"`.** Always use `"always"`, `"once"`, `"forward"`, or
> `"progress"` — project hard rule, see [[ai-agent-guide]].

## Common patterns

**Line-by-line heading reveal**
```tsx
<TextEngine
  tag="h1"
  lineIn={{ y: '0%', opacity: 1 }}
  lineOut={{ y: '100%', opacity: 0 }}
  lineStagger={100}
  lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
  overflow
>
  Your heading text
</TextEngine>
```

> [!warning] Match value types across `In` / `Out`
> A spring key must use the **same type** in its `In` and `Out` states — all
> numbers, or all unit strings. Mixing them (e.g. `y: 0` with `y: '100%'`) throws
> *"Cannot animate between _AnimatedString and _AnimatedValue"* at runtime. For a
> clipped line reveal use `y: '0%'` / `y: '100%'`; for a pixel slide use `y: 0` /
> `y: 60`.

**Word-by-word fade-up (body copy)**
```tsx
<TextEngine
  tag="p"
  wordIn={{ y: 0, opacity: 1 }}
  wordOut={{ y: 40, opacity: 0 }}
  wordStagger={60}
  wordConfig={{ duration: 700, easing: easings.easeOutQuart }}
>
  Animate every word independently
</TextEngine>
```

**Scroll-driven progress** — `mode="progress"` with `type="interpolate"` (smooth)
or `type="toggle"` (snap), plus `start`/`end` trigger positions. Used in
`views/home.tsx`.

**Factory shorthand** — `tengine.h2` returns a pre-tagged `TextEngine`:
```tsx
const H2 = tengine.h2;
<H2 mode="once" lineIn={{ y: 0, opacity: 1 }} lineOut={{ y: 60, opacity: 0 }}>…</H2>
```

## Key prop groups

- **Animation values:** `lineIn/Out`, `wordIn/Out`, `letterIn/Out` (+ `wrap*` variants).
- **Configs:** `lineConfig`, `wordConfig`, `letterConfig` (+ directional `*In`/`*Out`).
- **Timing:** `delayIn/Out`, per-layer `*DelayIn/Out`, `*Stagger` (+ directional).
- **Behaviour:** `overflow` (clip for slide-ins), `immediateOut`, `seo` (hidden
  plain-text copy for crawlers — default `true`).
- **Progress:** `type`, `start`, `end`, `trigger`, `interpolationStaggerCoefficient`.

Full prop tables: [[text-engine-reference]].

## Trigger position format

Shared with scroll components: `"<element-edge> <viewport-edge>[±=px]"`.

| Example | Meaning |
|---------|---------|
| `"top bottom"` | progress 0 when element top hits viewport bottom |
| `"bottom top"` | progress 1 when element bottom hits viewport top |
| `"top bottom+=200"` | start 200 px later |
| `"center center"` | element centre meets viewport centre |

## Imperative API

Via `ref` / `onTextEngine`: `playIn()`, `playOut()`, `togglePause()`,
`progress.current` (0–1), plus read-only `lines` / `words` / `letters`.
(Not used in normal scroll-driven flows.)

## Related

[[animation-system]] · [[text-engine-reference]]
