---
tags: [workflow, performance, seo, accessibility, stable]
updated: 2026-09-18
---

# Getting a page into the green

Lighthouse across laptop, tablet and mobile — all four categories — then fix what
the audit blames and prove it. Skill: `optimize-load`. Command: `/load`.
Hard rule 13. ADR: [[decisions-log]] ADR-0025.

**Green is ≥ 90, not 100.**

## Which skill

| what is slow | skill |
|---|---|
| the **load** — scores, Core Web Vitals, a11y, SEO | `optimize-load` (this note) |
| **after** the load — scroll jank, micro-freezes | [[optimize-performance]] |
| a three.js / WebGL scene | [[optimize-3d-scene]] — run it first |

The split matters because **Lighthouse never scrolls**. It measures navigation to
settled and stops, so an animation-heavy page can score well and still stutter the
moment anyone touches it. The two skills look at different halves of the same
visit and neither substitutes for the other.

## The loop

Build → audit all three profiles → attribute → fix one thing → re-audit.

| step | rule |
|---|---|
| 1. Build | audit `yarn build && yarn start`, never `next dev` |
| 2. Baseline | before touching anything, tagged, kept to diff against |
| 3. Repeat | **median of 3+ runs per profile** |
| 4. Attribute | read the phase breakdown before changing code |
| 5. Fix one thing | re-measure under the identical config |
| 6. Report | the full grid, and what you did not fix and why |

> [!warning] A single Lighthouse run is an anecdote
> Observed on one unchanged build: LCP swung **2.7s → 4.6s** and CLS flipped
> **0 → 0.18** between consecutive runs. Acting on a single run sends you off
> fixing noise — which is exactly what happened before the medians went in.

## What the report will not tell you

Two gaps that make this work slower than it should be, both handled by the probes
in the skill's `references/runner.md`:

- **Lighthouse often does not name the element that shifted.** Its
  `layout-shifts` audit returns scores with no node attached. A
  `PerformanceObserver` on `layout-shift` gives you `sources` with the element and
  its before/after rects.
- **A CLS of 0 can mean "the trace ended before the shift".** If a score gets
  *worse* the moment you make the page faster, suspect this before believing you
  caused a regression — a late animation that used to fall outside the
  observation window now falls inside it. Verify with the probe, which watches as
  long as you tell it to.

## Two findings worth carrying between projects

**axe samples animated pages mid-reveal.** Text caught at `opacity: 0.4` is
reported as a 1.1:1 contrast failure. It is an artifact, and chasing it is
unwinnable because the frame it catches changes every run. Fix the **resting**
values instead — compute every `--content-*` token against its surface. On this
starter's palette the floor for 4.5:1 is **black at 0.55** on the light surfaces
and **white at 0.46** on black; several shipped tokens were at 2.1–2.8:1. See
[[design-system]].

**Test the hypothesis before acting on it.** An opening loader that covers the
screen for four seconds is the obvious suspect for a bad LCP. Measured with it
removed entirely, TBT moved ~20ms and two of three profiles scored *worse* — the
real cost was bundle parse plus hydration. Ten minutes of measurement saved a day
of rewriting the wrong thing.

## When the number is capped by the design

An animation-heavy page can be structurally unable to reach 90 on mobile: per-word
text animation creates a DOM node and a spring per word, and that shows up as TBT
that no markup change touches. Likewise a geometry-animated reveal will always
cost CLS, because **CLS sums the distance travelled, not the number of frames** —
speeding it up does nothing.

When that is the case, **measure the cost, write it down, and give the user the
choice.** Do not quietly rewrite the design to win points. A finding with a number
attached is a good outcome; a silently altered brand moment is not.

## Where the detail lives

| | |
|---|---|
| the loop, in order | `.claude/skills/optimize-load/SKILL.md` |
| the Lighthouse runner, the CLS probe, contrast maths | `…/references/runner.md` |
| fixes by weight | `…/references/fixes.md` |

Both scripts install into a scratch directory — deliberately **not** project
dependencies.

## Closing the loop

`yarn lint` · `yarn build` · `.claude/scripts/verify.sh` (zero FAILs) · the
`qa-verify` skill if any UI changed — a contrast fix changes how the page looks,
and a token change touches every surface. Log the measured grid in [[changelog]],
and add an ADR for anything that sets a new rule or accepts a known cost.

## Related

[[optimize-performance]] · [[optimize-3d-scene]] · [[seo-aeo]] · [[ship]] · [[design-system]] · [[qa-verification]]
