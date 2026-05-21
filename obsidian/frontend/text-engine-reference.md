---
tags: [frontend, animation, reference, stable]
updated: 2026-05-21
---

# TextEngine — Full Reference

> Complete API reference for `spring-text-engine`. For the project-usage summary
> and rules, see [[text-engine]]. This note is the canonical full reference.

A scroll-aware, spring-animated text component built on [react-spring](https://react-spring.dev/).

Splits `children` into letter / word / line animation slots and drives them with independent springs. Mixed children are fully supported — plain strings animate alongside React elements (`<span>`, `<strong>`, etc.), and non-text elements (SVGs, icons, components) are treated as a single animated word unit.

**[Documentation & Playground →](https://textengine.textura.agency)** · [GitHub](https://github.com/textura-agency/spring-text-engine)

---

## Table of contents

1. [Installation / import](#installation--import)
2. [Animation layers](#animation-layers)
3. [Modes](#modes)
4. [Props reference](#props-reference)
5. [Examples](#examples)
   - [Line-by-line reveal](#1-line-by-line-reveal)
   - [Word-by-word fade up](#2-word-by-word-fade-up)
   - [Letter-by-letter cascade](#3-letter-by-letter-cascade)
   - [Mixed children with inline styling](#4-mixed-children-with-inline-styling)
   - [Once mode — plays once on first view](#5-once-mode--plays-once-on-first-view)
   - [Forward mode — only plays on downward scroll](#6-forward-mode--only-plays-on-downward-scroll)
   - [Manual mode — imperative control](#7-manual-mode--imperative-control)
   - [Manual mode with progress](#8-manual-mode-with-progress)
   - [Progress mode — scroll-driven](#9-progress-mode--scroll-driven)
   - [Progress mode with GSAP-style offsets](#10-progress-mode-with-gsap-style-offsets)
   - [rootMargin — offset the viewport trigger](#11-rootmargin--offset-the-viewport-trigger)
   - [Factory pattern — tengine](#12-factory-pattern--tengine)
6. [TriggerPos format](#triggerpos-format)
7. [Imperative instance API](#imperative-instance-api)

---

## Installation / import

```bash
npm install spring-text-engine
# or
yarn add spring-text-engine
# or
pnpm add spring-text-engine
```

`@react-spring/web` is a required peer dependency:

```bash
npm install @react-spring/web
```

```tsx
import TextEngine from 'spring-text-engine';
import type { TextEngineInstance, EngineProps } from 'spring-text-engine';

// or named imports
import { TextEngine, ProgressTrigger, tengine } from 'spring-text-engine';
```

---

## Animation layers

Each word is wrapped in up to 3 nested layers. Layers are only rendered when their corresponding `*In` prop is non-empty, keeping the DOM flat when a layer is not needed.

```
<wrapLine>          ← overflow clip + line-level spring
  <line>            ← line-staggered spring (all words on same line share the same delay)
    <wrapWord>      ← overflow clip + word spring
      <word>        ← word-level spring
        <wrapLetter> ← per-letter overflow clip
          <letter>  ← per-letter spring
        </wrapLetter>
      </word>
    </wrapWord>
  </line>
</wrapLine>
```

Each layer has an `In` target (enter state) and an `Out` target (exit state). Set the **out** state to the resting position (e.g. `{ y: 100, opacity: 0 }`) and the **in** state to the destination (e.g. `{ y: 0, opacity: 1 }`).

---

## Modes

| Mode | Behaviour |
|------|-----------|
| `"always"` | Plays in when the element enters the viewport; plays out when it leaves. Repeats. **(default)** |
| `"once"` | Plays in the first time the element enters the viewport. Never replays. |
| `"forward"` | Plays in on downward scroll into view. Does not replay on upward scroll back into view. |
| `"manual"` | No automatic trigger. Control via `instance.playIn()`, `instance.playOut()`, `instance.togglePause()`, or by writing to `instance.progress.current` (0–1). |
| `"progress"` | Animation is driven by scroll progress between `start` and `end` positions using `ProgressTrigger` internally. Sub-modes: `type="toggle"` (snap) or `type="interpolate"` (smooth). |

---

## Props reference

### Core

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `"always" \| "once" \| "forward" \| "manual" \| "progress"` | `"always"` | Animation trigger mode |
| `enabled` | `boolean` | `true` | Master enable switch |
| `tag` | `HtmlTags` | `"span"` | HTML tag for the container element |
| `columnGap` | `number \| "inherit"` | `0.3` | Gap between words in `em` |
| `overflow` | `boolean` | `false` | Sets `overflow: hidden` on wrapLine / wrapWord |
| `rootMargin` | `string` | `"0px"` | IntersectionObserver `rootMargin` (non-progress modes only). e.g. `"-100px 0px"` |
| `children` | `ReactNode` | — | Text and/or React elements to animate |

### Progress / scroll trigger (`mode="progress"`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `"toggle" \| "interpolate"` | `"toggle"` | How scroll progress drives animation |
| `interpolationStaggerCoefficient` | `number` | `0.3` | Spread of per-unit progress ranges in interpolate mode |
| `trigger` | `RefObject<HTMLElement>` | — | External element to use as scroll reference |
| `start` | `TriggerPos` | `"top bottom"` | Scroll position where progress = 0 |
| `end` | `TriggerPos` | `"bottom top"` | Scroll position where progress = 1 |

### Animation values

All default to `{}` (empty = layer not rendered).

| Prop | Description |
|------|-------------|
| `wrapLineIn` / `wrapLineOut` | wrapLine enter / exit spring target |
| `lineIn` / `lineOut` | Line enter / exit spring target |
| `wrapWordIn` / `wrapWordOut` | wrapWord enter / exit spring target |
| `wordIn` / `wordOut` | Word enter / exit spring target |
| `wrapLetterIn` / `wrapLetterOut` | wrapLetter enter / exit spring target |
| `letterIn` / `letterOut` | Letter enter / exit spring target |

### Spring configs

All optional `SpringConfig` objects. The shared config applies to both in and out; the directional overrides take precedence.

| Prop | Description |
|------|-------------|
| `lineConfig` | Line spring config (in + out) |
| `wordConfig` | Word spring config (in + out) |
| `letterConfig` | Letter spring config (in + out) |
| `lineConfigIn` / `lineConfigOut` | Line enter / exit spring config override |
| `wordConfigIn` / `wordConfigOut` | Word enter / exit spring config override |
| `letterConfigIn` / `letterConfigOut` | Letter enter / exit spring config override |

### Timing (all in ms)

| Prop | Default | Description |
|------|---------|-------------|
| `delayIn` | `0` | Global delay before the entire enter animation |
| `delayOut` | `0` | Global delay before the entire exit animation |
| `lineDelayIn` / `lineDelayOut` | `0` | Extra per-layer delay on top of global delay |
| `wordDelayIn` / `wordDelayOut` | `0` | |
| `letterDelayIn` / `letterDelayOut` | `0` | |
| `lineStagger` | `0` | Per-line stagger delay shared for in + out |
| `wordStagger` | `0` | Per-word stagger delay shared for in + out |
| `letterStagger` | `0` | Per-letter stagger delay shared for in + out |
| `lineStaggerIn` / `lineStaggerOut` | `0` | Override stagger for one direction |
| `wordStaggerIn` / `wordStaggerOut` | `0` | |
| `letterStaggerIn` / `letterStaggerOut` | `0` | |

> **Line stagger** is based on the line index (all words on the same line get the same delay). Word and letter stagger are based on their global sequential index.

### Behaviour flags

| Prop | Default | Description |
|------|---------|-------------|
| `immediateOut` | `true` | Exit animation is instant (no spring, no stagger). Set `false` for a full animated exit |
| `enableInOutDelayesOnRerender` | `false` | Apply delays when children change reactively. Default suppresses delays for instant swaps |

### SEO

| Prop | Default | Description |
|------|---------|-------------|
| `seo` | `true` | Renders a visually-hidden plain-text copy so crawlers and screen readers see unsplit content |

### CSS class hooks

| Prop | Description |
|------|-------------|
| `className` | Container element |
| `wrapLineClassName` | Every wrapLine span |
| `lineClassName` | Every line span |
| `wrapWordClassName` | Every wrapWord span |
| `wordClassName` | Every word span |
| `wrapLetterClassName` | Every wrapLetter span |
| `letterClassName` | Every letter span |

### Callbacks

| Prop | Signature | Description |
|------|-----------|-------------|
| `onTextEngine` | `(ref: RefObject<TextEngineInstance>) => void` | Called on mount with the instance ref |
| `onTextStart` | `TextEngineHandlerType` | Fires when any spring starts animating |
| `onTextChange` | `TextEngineHandlerType` | Fires on every spring frame |
| `onTextResolve` | `TextEngineHandlerType` | Fires when any spring settles |
| `onTextFullyPlayed` | `(type: "in" \| "out") => void` | Fires once after the full sequence finishes |

---

## Examples

### 1. Line-by-line reveal

Each line slides up from below and fades in. Lines stagger by 100 ms. The `overflow` flag clips the text so the slide starts hidden.

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function Hero() {
  return (
    <TextEngine
      tag="h1"
      lineIn={{ y: '0%', opacity: 1 }}
      lineOut={{ y: '100%', opacity: 0 }}
      lineStagger={100}
      lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
      overflow
    >
      The quick brown fox
    </TextEngine>
  );
}
```

---

### 2. Word-by-word fade up

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function Subtitle() {
  return (
    <TextEngine
      tag="p"
      wordIn={{ y: 0, opacity: 1 }}
      wordOut={{ y: 40, opacity: 0 }}
      wordStagger={60}
      wordConfig={{ duration: 700, easing: easings.easeOutQuart }}
    >
      Animate every word independently
    </TextEngine>
  );
}
```

---

### 3. Letter-by-letter cascade

```tsx
import { config } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function Title() {
  return (
    <TextEngine
      tag="h2"
      letterIn={{ y: 0, opacity: 1, scale: 1 }}
      letterOut={{ y: 20, opacity: 0, scale: 0.8 }}
      letterStagger={30}
      letterConfig={config.gentle}
    >
      Hello world
    </TextEngine>
  );
}
```

---

### 4. Mixed children with inline styling

Plain text and styled `<span>` elements animate together. Words inside the span are animated individually while the span's `style` and `className` props are preserved on each word.

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function Headline() {
  return (
    <TextEngine
      tag="h1"
      letterIn={{ y: 0, opacity: 1 }}
      letterOut={{ y: 30, opacity: 0 }}
      letterStagger={25}
      letterConfig={{ duration: 600, easing: easings.easeOutExpo }}
    >
      Hello{' '}
      <span style={{ color: 'red' }}>world</span>
      {' '}this is{' '}
      <span style={{ color: 'blue' }}>
        cool <span style={{ fontWeight: 700 }}>stuff</span>
      </span>
    </TextEngine>
  );
}
```

> Non-text children (SVGs, icons) are treated as a single word unit and share the word-level spring.

---

### 5. Once mode — plays once on first view

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function SectionTitle() {
  return (
    <TextEngine
      tag="h2"
      mode="once"
      lineIn={{ y: 0, opacity: 1 }}
      lineOut={{ y: 60, opacity: 0 }}
      lineStagger={120}
      lineConfig={{ duration: 1000, easing: easings.easeOutCubic }}
      overflow
    >
      Plays in exactly once
    </TextEngine>
  );
}
```

---

### 6. Forward mode — only plays on downward scroll

The animation plays in when the user scrolls down to the element. If they scroll back up and then down again, it does **not** replay.

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function Paragraph() {
  return (
    <TextEngine
      tag="p"
      mode="forward"
      wordIn={{ y: 0, opacity: 1 }}
      wordOut={{ y: 20, opacity: 0 }}
      wordStagger={40}
      wordConfig={{ duration: 600, easing: easings.easeOutQuart }}
    >
      Only animates in on forward scroll
    </TextEngine>
  );
}
```

---

### 7. Manual mode — imperative control

Control playback entirely from the parent via a ref.

```tsx
import { useRef } from 'react';
import { easings } from '@react-spring/web';
import TextEngine, { type TextEngineInstance } from 'spring-text-engine';

export function ManualExample() {
  const engineRef = useRef<TextEngineInstance | null>(null);

  return (
    <>
      <TextEngine
        ref={engineRef}
        mode="manual"
        tag="h1"
        lineIn={{ y: 0, opacity: 1 }}
        lineOut={{ y: 80, opacity: 0 }}
        lineStagger={100}
        lineConfig={{ duration: 1000, easing: easings.easeOutCubic }}
        overflow
        onTextEngine={(ref) => { engineRef.current = ref.current; }}
      >
        Manual control
      </TextEngine>

      <button onClick={() => engineRef.current?.playIn()}>Play In</button>
      <button onClick={() => engineRef.current?.playOut()}>Play Out</button>
      <button onClick={() => engineRef.current?.togglePause()}>Pause</button>
    </>
  );
}
```

---

### 8. Manual mode with progress

Write a 0–1 value to `instance.progress.current` on each animation frame. The engine polls it via an internal loop and drives the springs accordingly.

```tsx
import { useRef, useEffect } from 'react';
import TextEngine, { type TextEngineInstance } from 'spring-text-engine';

export function ScrollDrivenManual() {
  const engineRef = useRef<TextEngineInstance | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById('section');
      if (!el || !engineRef.current?.progress) return;
      const { top, height } = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - top / (window.innerHeight - height)));
      engineRef.current.progress.current = p;
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <TextEngine
      ref={engineRef}
      mode="manual"
      type="toggle"
      tag="p"
      wordIn={{ y: 0, opacity: 1 }}
      wordOut={{ y: 30, opacity: 0 }}
      wordStagger={50}
      onTextEngine={(ref) => { engineRef.current = ref.current; }}
    >
      Driven by custom scroll logic
    </TextEngine>
  );
}
```

---

### 9. Progress mode — scroll-driven

`mode="progress"` wires the animation directly to scroll position between `start` and `end`. No manual scroll handling needed.

#### Toggle sub-mode

Each word snaps to its `in` or `out` state as the scroll position crosses its stagger threshold.

```tsx
import TextEngine from 'spring-text-engine';

export function ToggleProgress() {
  return (
    <TextEngine
      tag="p"
      mode="progress"
      type="toggle"
      start="top bottom"
      end="bottom top"
      wordIn={{ y: 0, opacity: 1 }}
      wordOut={{ y: 40, opacity: 0 }}
      wordStagger={60}
    >
      Words snap in as you scroll
    </TextEngine>
  );
}
```

#### Interpolate sub-mode

Each word smoothly interpolates between `in` and `out` as scroll progresses. The `interpolationStaggerCoefficient` controls how staggered the per-word progress windows are.

```tsx
import TextEngine from 'spring-text-engine';

export function InterpolateProgress() {
  return (
    <TextEngine
      tag="p"
      mode="progress"
      type="interpolate"
      interpolationStaggerCoefficient={0.2}
      start="top 80%"
      end="bottom 20%"
      letterIn={{ y: 0, opacity: 1 }}
      letterOut={{ y: 20, opacity: 0 }}
    >
      Letters interpolate smoothly with scroll
    </TextEngine>
  );
}
```

---

### 10. Progress mode with GSAP-style offsets

Trigger positions support pixel offsets using `+=` and `-=` syntax. The first word is the element edge (`top`/`center`/`bottom`), the second is the viewport edge, and the optional suffix shifts the trigger point.

`+=N` — trigger fires N px later in the scroll direction.
`-=N` — trigger fires N px earlier.

```tsx
import TextEngine from 'spring-text-engine';

export function OffsetProgress() {
  return (
    <TextEngine
      tag="h2"
      mode="progress"
      type="toggle"
      // start 200px before the element's top hits the viewport bottom
      start="top bottom+=200"
      // end 100px after the element's bottom passes the viewport top
      end="bottom top-=100"
      lineIn={{ y: 0, opacity: 1 }}
      lineOut={{ y: 60, opacity: 0 }}
      lineStagger={80}
    >
      Offset trigger points
    </TextEngine>
  );
}
```

You can also use an external element as the scroll reference:

```tsx
import { useRef } from 'react';
import TextEngine from 'spring-text-engine';

export function ExternalTrigger() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} style={{ height: '300vh' }}>
      <TextEngine
        mode="progress"
        type="toggle"
        trigger={sectionRef}
        start="top bottom"
        end="bottom top"
        wordIn={{ opacity: 1, y: 0 }}
        wordOut={{ opacity: 0, y: 30 }}
        wordStagger={40}
      >
        Triggered by the parent section
      </TextEngine>
    </div>
  );
}
```

---

### 11. rootMargin — offset the viewport trigger

In non-progress modes (`always`, `once`, `forward`, `manual`) the IntersectionObserver `rootMargin` shifts when the element is considered "in view". Negative values trigger the animation later (the element must be further inside the viewport).

```tsx
import { easings } from '@react-spring/web';
import TextEngine from 'spring-text-engine';

export function LateEntrance() {
  return (
    <TextEngine
      tag="p"
      mode="always"
      // only triggers when the element is at least 150px inside the viewport
      rootMargin="-150px 0px"
      lineIn={{ y: 0, opacity: 1 }}
      lineOut={{ y: 50, opacity: 0 }}
      lineStagger={80}
      lineConfig={{ duration: 800, easing: easings.easeOutCubic }}
      overflow
    >
      Animates only when well inside the viewport
    </TextEngine>
  );
}
```

---

### 12. Factory pattern — tengine

`tengine` is a `Proxy`-based factory that returns a pre-configured `TextEngine` for any HTML tag. Useful when you want a typed tag without passing the `tag` prop.

```tsx
import { tengine } from 'spring-text-engine';
import { easings } from '@react-spring/web';

const H1 = tengine.h1;
const P  = tengine.p;

export function FactoryExample() {
  return (
    <>
      <H1
        lineIn={{ y: 0, opacity: 1 }}
        lineOut={{ y: 80, opacity: 0 }}
        lineStagger={100}
        lineConfig={{ duration: 1000, easing: easings.easeOutCubic }}
        overflow
      >
        Heading with line animation
      </H1>
      <P
        wordIn={{ y: 0, opacity: 1 }}
        wordOut={{ y: 20, opacity: 0 }}
        wordStagger={40}
        wordConfig={{ duration: 600, easing: easings.easeOutQuart }}
      >
        Paragraph with word animation
      </P>
    </>
  );
}
```

---

## TriggerPos format

Used by `start` and `end` props (and `ProgressTrigger` component directly).

```
"<element-edge> <viewport-edge>"
"<element-edge> <viewport-edge>+=<px>"
"<element-edge> <viewport-edge>-=<px>"
```

- **element-edge**: `top` | `center` | `bottom` — edge of the target element
- **viewport-edge**: `top` | `center` | `bottom` — edge of the viewport
- **offset** (optional): `+=200` adds 200 px, `-=100` subtracts 100 px

| Example | Meaning |
|---------|---------|
| `"top bottom"` | Progress = 0 when element top reaches viewport bottom |
| `"bottom top"` | Progress = 1 when element bottom reaches viewport top |
| `"top bottom+=200"` | Progress = 0 starts 200 px after element top would normally hit viewport bottom |
| `"center center"` | Triggers when element center aligns with viewport center |
| `"bottom top-=100"` | Progress = 1 fires 100 px before element bottom hits viewport top |

---

## Imperative instance API

Accessed via `ref` or the `onTextEngine` callback.

```ts
interface TextEngineInstance {
  mode:         string;            // reflects current mode prop
  enabled:      boolean;           // reflects effective enabled state
  lines:        LineRef[][];       // DOM word refs grouped by line
  words:        string[][];        // all words as char arrays
  letters:      string[];          // all chars
  playIn():     void;              // trigger enter animation (manual mode)
  playOut():    void;              // trigger exit animation  (manual mode)
  togglePause(): void;             // freeze / unfreeze animation
  progress:     RefObject<number>; // write 0–1 for progress-based manual control
}
```

```tsx
const ref = useRef<TextEngineInstance>(null);

// Trigger playback
ref.current?.playIn();
ref.current?.playOut();

// Progress-based control (manual mode)
ref.current!.progress!.current = 0.5;

// Read layout data
console.log(ref.current?.lines);   // [[{ word, index, lineIndex }, ...], ...]
console.log(ref.current?.letters); // ['H','e','l','l','o', ...]
```
