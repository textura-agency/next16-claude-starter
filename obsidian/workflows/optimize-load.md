---
tags: [workflow, performance, seo, accessibility, stable]
updated: 2026-10-06
---

# Getting a page into the green

Lighthouse on PC and mobile — all four categories, people runs **and** the robot
form — then fix what the audit blames and prove it. Skill: `optimize-load`.
Command: `/load`. Hard rule 13. ADRs: [[decisions-log]] ADR-0025, ADR-0026.

**The bar** (from 50+ production sites — [[testing-pipeline]]): Performance
**≥ 90 on PC and on mobile** (green is ≥ 90, not 100); Accessibility, Best
Practices and SEO **100** on both, in people runs and on the robot form. PC and
mobile are the record; tablet is for digging.

> [!tip] Read before you start
> [[fix-catalog]] §1–3 and §6–8 hold every load fix that moved a number on a
> production site, with evidence; [[pitfalls]] §1 holds every way the
> measurement lied. Most first passes are already written down there.

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

Build → audit PC + mobile, people + robot → attribute → fix one thing → re-audit
→ confirm on the real host.

| step | rule |
|---|---|
| 1. Build | audit `yarn build && yarn start`, never `next dev` |
| 2. Baseline | before touching anything, tagged, kept to diff against |
| 3. Repeat | **median of 3+ runs per profile**; A/B back to back, interleaved, the machine's load noted |
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

## The levers, in the order they usually pay

Measured on 50+ sites; details and evidence in [[fix-catalog]].

1. **The LCP waits on a loader, curtain or entrance** → serve the LCP copy at rest
   under the opaque curtain, switch to the start state after a reported paint,
   replay the entrance (rule). The consent banner as LCP → it is server-rendered
   in the starter; keep it that way.
2. **Raw-path media** — anything that fetches `public/` by path (`new Image()`,
   CSS `url()`, preloads, `<picture>`) → warm the `getImageProps` candidate (rule;
   hosted LCP 31 → 3.7 s once).
3. **Hydration TBT** → text engines below the fold mount near the viewport; one
   clock per text effect instead of a spring per letter; no hover springs on
   touch; the curtain-lift's entrances in their own tasks; heavy blocks hydrate
   one per idle moment (all rules — cut the work per block before splitting).
4. **3D at load** → geometry in a Worker; the whole scene in an OffscreenCanvas
   worker on phones, after load; prewarm every program against the real targets;
   compressed models; three.js out of the first load ([[optimize-3d-scene]]).
5. **Bytes on the first screen** → Latin WOFF2 font subsets, self-hosted font
   CSS, `experimental.inlineCss`, video encoded by role (H.264, never HEVC), zod
   out of the client.
6. **A11y 100 in people runs** → run `yarn qa:axe` first: a first-screen
   opacity fade is sampled mid-way — reveal with a mask/clip sweep at opacity 1;
   real failures → repoint the text token; decorative text as generated content.
7. **Best Practices** → every linked route exists (a prefetched `<Link>` to a
   missing page is a console 404).

Two traps to know before reading any report: Lighthouse's long-task times are
**simulated** (map them by the observed trace), and **localhost LCP is not the
host's** — the record is the deployed preview ([[pitfalls]] §1).

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
| the testing order and the bars | [[testing-pipeline]] |
| measured fixes · what misled people | [[fix-catalog]] · [[pitfalls]] |
| the tools (`qa:lh`, `qa:axe`, `profile.mjs`) | `tools/qa/README.md` |
| the Lighthouse runner, the CLS probe, contrast maths | `…/references/runner.md` |
| fixes by weight | `…/references/fixes.md` |

The tools install into a cache directory outside the project — deliberately
**not** project dependencies.

## Closing the loop

`yarn lint` · `yarn build` · `.claude/scripts/verify.sh` (zero FAILs) · the
`qa-verify` skill if any UI changed — a contrast fix changes how the page looks,
and a token change touches every surface. Log the measured grid in [[changelog]],
and add an ADR for anything that sets a new rule or accepts a known cost. A fix
that moved a number belongs in [[fix-catalog]] ([[knowledge/README]] has the
evidence rules). Then check the page on a phone — [[mobile-device-qa]].

## Related

[[testing-pipeline]] · [[fix-catalog]] · [[pitfalls]] · [[optimize-performance]] · [[optimize-3d-scene]] · [[mobile-device-qa]] · [[seo-aeo]] · [[ship]] · [[design-system]] · [[qa-verification]]
