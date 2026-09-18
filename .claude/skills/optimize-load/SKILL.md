---
name: optimize-load
description: Get a page into Lighthouse's green zone on laptop, tablet and mobile — build it, audit all four categories (Performance, Accessibility, Best Practices, SEO) across the three form factors, fix what the audit blames, re-measure to prove it. Covers LCP, CLS, TBT/INP, render-blocking and bundle cost, colour contrast, 404s from linked-but-missing routes, metadata and crawlability. Use when the user says "check Lighthouse", "get it in the green", "improve the score", "Core Web Vitals", "test on mobile and desktop", "SEO and accessibility audit", "make it load fast", or before handing a site to a client. For scroll jank and micro-freezes *after* load, use `optimize-performance` instead.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Get the page into the green

Lighthouse, three form factors, four categories, then fix and prove it.

**Green is ≥ 90, not 100.** A 96 is green. Spending an afternoon chasing the last
four points — which are usually an audit artifact, not a defect — is the most
common way this work goes wrong.

> **Scope.** This skill owns the **load**: what Lighthouse measures, from
> navigation to settled. Scroll jank, micro-freezes and dropped frames *after*
> load belong to **`optimize-performance`** — Lighthouse never scrolls, so it
> cannot see them. If the project renders a three.js / WebGL scene, run
> **`optimize-3d-scene`** first.

## The loop

Build → audit all three profiles → attribute → fix one thing → re-audit.
Never report a score you did not re-measure.

## 0. Rules of measurement

Ignoring these produces confident wrong answers. Each one cost real time to learn.

1. **Audit the build, never `next dev`.** `yarn build && yarn start`.
2. **Take the median of at least 3 runs per profile.** This is not optional.
   Observed on one unchanged build: LCP swung **2.7s → 4.6s** and CLS flipped
   **0 → 0.18** between consecutive runs. A single run is an anecdote, and acting
   on one sends you off fixing noise.
3. **Baseline before you touch anything**, and re-measure with the identical
   config.
4. **A category can be flaky for a real reason.** Accessibility that reads 96 on
   one run and 100 on the next is axe sampling the page mid-animation — see §3.
5. **Change one thing at a time.**
6. **Test the hypothesis before you act on it.** In one case the opening loader
   was the obvious suspect for a 4s LCP; removing it entirely moved TBT by 20ms
   and made two profiles *worse*. Ten minutes of measurement saved a day of
   rewriting the wrong thing.

## 1. Run it

`references/runner.md` has the runner — Lighthouse's Node API across laptop,
tablet and mobile, medians, and the per-audit failure list. It installs into a
scratch directory, not the project.

Report the grid, always all four categories × all three profiles:

| | laptop | tablet | mobile |
|---|---|---|---|
| Performance | | | |
| Accessibility | | | |
| Best Practices | | | |
| SEO | | | |

Mobile is the hard one — Lighthouse throttles it to 4× CPU and slow 4G. Laptop
passing tells you almost nothing about a phone.

## 2. Attribute before fixing

**Performance weights**: TBT 30, LCP 25, CLS 25, FCP 10, SI 10. Only those five
move the number; the "Opportunities" list is weight 0 and is advice, not score.

**Read the LCP phase breakdown** — it names the fix, and guessing wastes hours:

| dominant phase | what it means |
|---|---|
| **TTFB** | server or hosting |
| **Load Delay** | the image is discovered late — preload it, or it is behind JS |
| **Load Time** | the file is too big, or it is competing for bandwidth |
| **Render Delay** | it is downloaded but not painted — the main thread is busy, or something covers it. **Not a network problem.** |

**CLS: Lighthouse does not tell you what moved.** Its `layout-shifts` audit
routinely returns scores with no node attached. Use the `PerformanceObserver`
probe in `references/runner.md` — it reports each shift with the element, its
before/after rect and the timestamp. Every CLS hunt starts there.

**TBT**: `mainthread-work-breakdown` and `bootup-time` per chunk. If Script
Evaluation dominates and no single function stands out in a CPU profile, the cost
is bundle parse plus hydration — a structural problem, not a hot loop.

## 3. Two audit artifacts that will mislead you

**axe samples once, and on an animated page it samples mid-animation.** Text
caught at `opacity: 0.4` during a reveal is reported as a contrast failure at
1.1:1. It is not a defect — the resting state is fine. Chasing these is
unwinnable because the frame it catches changes every run.

The right response: **audit the resting values instead.** Compute every
`--content-*` token against the surface it sits on and fix the ones that genuinely
fail (§4). That removes the real defects and stabilises the score; the residual
flake is not worth touching.

**A CLS of 0 can mean "the trace ended before the shift".** If a score improves
the moment you make the page faster, suspect this: a late animation that used to
fall outside the observation window now falls inside it. Verify against the
PerformanceObserver probe, which watches for as long as you tell it to, before
you believe you caused a regression.

## 4. Fix, in weight order

Full playbook with code in `references/fixes.md`. The short version:

- **Linked-but-missing routes** are the cheapest point on the board. A footer or
  cookie-banner link to a page that does not exist is a 404, a console error, a
  Best-Practices hit and a crawl error. Check every `href` resolves.
- **Contrast is arithmetic, not taste.** On this starter's surfaces the floor for
  4.5:1 is **black at 0.55 alpha** on the light surfaces and **white at 0.46** on
  black. Anything dimmer that carries words is a failure however deliberate it
  looks. Add a new Tier-1 alpha and repoint the semantic token — do not edit the
  old raw value, because borders share it and are held to 3:1, not 4.5:1.
- **LCP**: `priority` on the hero image and nothing else; make sure nothing else
  is competing for bandwidth during load.
- **CLS**: reserve space for anything that grows — images, webfonts, and any
  number that counts up. **CLS sums the distance travelled, not the number of
  frames**, so speeding an animation up does not reduce it. An element animated
  by `left/top/width/height` will always cost CLS; only a transform is free.
- **TBT**: fewer client components, less per-word text animation, smaller bundle.

## 5. Report honestly

Give the full grid before and after, and say plainly which categories are green
and which are not. Then:

- what you changed, and which measurement blamed it;
- **what you did not fix and why** — especially anything capped by a design
  decision rather than a bug. Name the decision and its measured cost so the user
  can make the call; do not quietly rewrite their design to win points.
- anything that is an audit artifact rather than a defect, and why you left it.

If a category cannot reach 90 without changing the design's motion or content
budget, **say so with the number attached**. That is a finding, not a failure.

## 6. Close the loop

`yarn lint` · `yarn build` · `.claude/scripts/verify.sh` (zero FAILs) · the
`qa-verify` skill if any UI changed — a contrast fix changes how the page looks,
and a token change touches every surface. Then update the vault: the measured
grid in `obsidian/meta/changelog.md`, and an ADR for anything that sets a new
rule or accepts a known cost.

## Related

[[optimize-load]] · [[optimize-performance]] · [[seo-aeo]] · [[ship]] · [[qa-verification]]
