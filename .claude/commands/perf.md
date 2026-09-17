---
description: Measure page performance in real Chrome, fix what the numbers blame, prove it
argument-hint: [url-or-route?]
---

Optimise performance for: **$ARGUMENTS** (the home route if empty).

Use the `optimize-performance` skill. The loop is the point — build, measure,
attribute, fix one thing, re-measure:

1. `yarn build && yarn start` — never measure `next dev`.
2. **Baseline first.** Scroll the whole page twice (cold, then warm) at 4× CPU
   throttle, 3–5 runs. If the first scroll is worse than the second, the page is
   doing first-visit work inside animating frames — that is the diagnosis.
3. Attribute before fixing. Frames dropping with no long JS task means GPU,
   raster or image decode — not JavaScript.
4. Fix one thing. Re-measure with the identical config.
5. `.claude/scripts/verify.sh`, `yarn lint`, `yarn build`, and `qa-verify` if any
   UI changed — a perf fix that silences a reveal is not a win.

If the project renders a three.js / WebGL scene, run `optimize-3d-scene` first.

Report the before and after numbers with the config they were taken under, what
you changed, and what you did not fix and why. Never report a win you did not
re-measure.
