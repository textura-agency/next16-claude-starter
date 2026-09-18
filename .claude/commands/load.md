---
description: Lighthouse across laptop/tablet/mobile, fix what it blames, prove it
argument-hint: [url-or-route?]
---

Audit and fix load performance for: **$ARGUMENTS** (the home route if empty).

Use the `optimize-load` skill. The loop is the point:

1. `yarn build && yarn start` — never audit `next dev`.
2. **Baseline first**, all four categories × laptop, tablet and mobile,
   **median of at least 3 runs each**. A single run is an anecdote — LCP and CLS
   swing wildly between identical runs.
3. Attribute before fixing. Read the LCP phase breakdown; use the
   `PerformanceObserver` probe for CLS, because Lighthouse usually will not name
   the element that moved.
4. Fix one thing, re-measure with the identical config.
5. `.claude/scripts/verify.sh`, `yarn lint`, `yarn build`, and `qa-verify` if any
   UI changed — a contrast fix changes how the page looks.

Green is **≥ 90, not 100**. Do not burn time on the last few points when they are
an audit artifact — axe samples animated pages mid-reveal.

For scroll jank after load use `optimize-performance`; for a three.js/WebGL scene
run `optimize-3d-scene` first.

Report the full grid before and after, what you changed, and what you did not fix
and why — especially anything capped by a design decision rather than a bug.
