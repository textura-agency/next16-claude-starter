---
tags: [workflow, performance, stable]
updated: 2026-09-17
---

# Optimising page performance

How performance work is done in this starter: **build, measure, attribute, fix
one thing, re-measure.** Skill: `optimize-performance`. Command: `/perf`.
Hard rule 13. ADR: [[decisions-log]] ADR-0024.

For a three.js / WebGL scene, [[optimize-3d-scene]] comes first — that skill owns
the GPU scene, this one owns the page around it.

## Why this exists as its own workflow

Lighthouse measures a cold **load**. It never scrolls. Everything this starter is
built for — springs on scroll, text engines, Lenis, full-bleed imagery — happens
*after* load, and is invisible to it.

The characteristic failure is a page that stutters on the **first** scroll and is
perfectly smooth on every one after. That is not a slow page. It is a page doing
first-visit work — fetching, decoding, laying out, rasterising — inside the exact
frames a reveal animation is trying to run in. You will not notice it yourself,
because by the time you scroll your own site you have already warmed it.

So the first diagnostic is always: **scroll the whole page twice and compare.**

## The loop

| step | rule |
|---|---|
| 1. Build | measure `yarn build && yarn start`, never `next dev` |
| 2. Baseline | take it *before* touching anything, or the win cannot be proved |
| 3. Repeat | 3–5 runs, compare medians; one run is an anecdote |
| 4. Throttle | 4× CPU, so a phone's problems are visible on a laptop |
| 5. Attribute | find what the trace blames before changing code |
| 6. Fix one thing | then re-measure under the *identical* config |
| 7. Report | before and after, with the config; say what you did not fix |

## Reading the diagnosis

- **First scroll worse than second** → first-visit work in animating frames. The
  usual cause is lazy media decoding as it is revealed.
- **Both equally janky** → steady-state per-frame cost: too many per-frame
  `getBoundingClientRect` reads, or a spring driving a non-compositor property.
- **Both smooth** → the complaint is about load, not scroll. Core Web Vitals.

> [!important] Frames dropping with no long JS task is not a JS problem
> If the longest main-thread task during a 300ms freeze is ~20ms, the main thread
> is idle and the stall is in the GPU process — raster, texture upload or image
> decode. Optimising JavaScript there wastes a day. The skill's
> `references/measuring.md` has the trace recipe that shows this.

## Two traps worth knowing before you start

**Tracing perturbs what it measures.** Take headline numbers untraced; use a
trace only to explain *why*. And never include the `cc` / `viz` trace categories
— they produce a trace whose own overhead swamps the jank, so the problem appears
to vanish.

**Do not warm a page by pre-scrolling it.** It is the obvious fix and it destroys
the work: a pre-scroll consumes every `mode="once"` reveal and `<Inview>` trigger
before anyone sees them. Warm the *media*, not the scroll position.

## Where the detail lives

| | |
|---|---|
| the loop, in order | `.claude/skills/optimize-performance/SKILL.md` |
| the scroll bench, and how to read it | `…/references/measuring.md` |
| the fixes, most-likely first | `…/references/fixes.md` |

The bench uses `playwright-core` installed in a scratch directory — deliberately
**not** a project dependency, so the starter stays clean.

## Closing the loop

`yarn lint` · `yarn build` · `.claude/scripts/verify.sh` (zero FAILs) · the
`qa-verify` skill if any UI changed — a perf fix that breaks a reveal is not a
win. Then log the measured numbers in [[changelog]], and add an ADR if the fix
changed how the project works.

## Related

[[optimize-3d-scene]] · [[qa-verification]] · [[ship]] · [[animation-system]] · [[agent-harness]]
