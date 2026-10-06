---
description: Verify the current work against the hard rules, the design, and the browsers it will meet
argument-hint: [path-or-section?]
---

Run verification on: **$ARGUMENTS** (whole `src/` if empty).

Use the `qa-verify` skill. In short:

1. `.claude/scripts/verify.sh $ARGUMENTS` — every FAIL must be fixed; WARNs are
   fixed or explicitly justified.
2. `yarn lint`, `npx tsc --noEmit -p .` and `yarn build`.
3. The judgement pass: design fidelity against a re-fetched Figma node, token
   discipline, motion primitive choice, semantics and a11y, responsive behaviour
   down to 320px, architecture (routes delegate, server-first, props not
   hardcoded content).
4. The browser pass on `yarn start` (`yarn qa:setup` once; person's UA, look at
   every screenshot):
   - `node tools/qa/axe-sweep.mjs --url …` — contrast/target-size through the
     entrance, not just at rest
   - `node tools/qa/resize-check.mjs --url …` — live resizes and
     DevTools device-preset switches land where a fresh load does
   - `node tools/qa/check-motion.mjs --url …` — reduced motion and the robot form
     don't hang
   - `scrollWidth === innerWidth` at 320–430; overlays in dark scheme too
   - anything a phone shows changed → `/mobile`
5. Fix, then re-run from step 1 until clean.

Report what failed, what you fixed, what you consciously left, and anything you
could not verify (no design, no real device, iOS-only behaviour).
