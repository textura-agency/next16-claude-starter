---
description: Lighthouse for people and the robot form, mobile and desktop — fix what it blames, prove it
argument-hint: [url-or-route?]
---

Audit and fix load for: **$ARGUMENTS** (the home route if empty).

Use the `optimize-load` skill. The loop is the point:

1. `yarn build && yarn start` — never audit `next dev`. `yarn qa:setup` once.
2. **Baseline first:** `node tools/qa/lighthouse.mjs --url http://localhost:3000/ --runs 3`
   and again with `--as-bot` — all four categories × mobile/desktop × **people
   and robot** (crawlers and PageSpeed get the robot form). `--ab <reference>`
   interleaves an A/B on a busy machine. Medians; 5 runs before calling a regression.
   Then `node tools/qa/axe-sweep.mjs --url …` — contrast through the whole
   entrance, and at-rest failures Lighthouse can't see over a canvas.
3. **Attribute before fixing.** Read the LCP phase breakdown and the LCP
   element's *timing*; the `PerformanceObserver` probe for CLS; name TBT's code
   with `node tools/qa/profile.mjs --url …` (Lighthouse's long-task times are
   simulated). Check `obsidian/knowledge/fix-catalog.md` first.
4. Fix one thing, re-measure with the identical config.
5. `.claude/scripts/verify.sh`, `yarn lint`, `yarn build`, and `qa-verify` if any
   UI changed — a contrast fix changes how the page looks.

**The bar:** Performance ≥ 90 on mobile and desktop; Accessibility, Best
Practices and SEO = 100, people and robot. A mid-fade A11y flake is fixable
without changing the look (reveal by transform/clip/mask with opacity 1). Local
numbers are a floor — take the record on the deployed URL (`--url https://…`).

For scroll jank after load use `optimize-performance`; for a three.js/WebGL scene
run `optimize-3d-scene` first; for real-phone behaviour `mobile-device-qa`.

Report the full grid before and after, what you changed, what you reverted, and
what you did not fix and why — especially anything capped by a design decision
rather than a bug (with its measured cost). Close with the retro: measured fixes
→ `obsidian/knowledge/fix-catalog.md`, traps → `obsidian/knowledge/pitfalls.md`.
