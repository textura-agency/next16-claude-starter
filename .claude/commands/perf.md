---
description: Scroll the page in real Chrome on PC and phone, fix what the frames blame, prove it
argument-hint: [url-or-route?]
---

Optimise scroll performance for: **$ARGUMENTS** (the home route if empty).

Use the `optimize-performance` skill. If the project renders a three.js / WebGL
scene, run `optimize-3d-scene` first. The loop is the point — build, measure,
attribute, fix one thing, re-measure:

1. `yarn build && yarn start` — never measure `next dev`. `yarn qa:setup` once.
2. **Baseline first:** `node tools/qa/scroll-test.mjs --url http://localhost:3000/`
   — PC (wheel) and mobile (touch, 4× CPU, 4G), cold then warm, 3 runs; every
   frame over 50 ms with its section, cause and reproducibility. Add
   `--first-scroll` when the page has a loader. On a WebGL page
   also `node tools/qa/fps-probe.mjs --url …` (the scene's real draw rate).
3. **Attribute before fixing.** Cold bad / warm clean = first-visit work inside
   animating frames. A `gpu / raster` frame with the main thread idle is GPU work
   (blur per letter, layer promotion, fill) — not JavaScript. Name the code with
   `node tools/qa/profile.mjs --url … --scroll-to "<selector>"`.
4. **Fix one thing**, re-measure with the identical config (interleave A/B runs
   on a busy machine). Check the fix-catalog first: `obsidian/knowledge/fix-catalog.md`.
5. `.claude/scripts/verify.sh`, `yarn lint`, `yarn build`,
   `node tools/qa/check-motion.mjs --url …`, and `qa-verify` if any UI changed —
   a perf fix that silences a reveal is not a win. Anything a phone shows
   changed → `mobile-device-qa`.
6. **Retro** — a measured fix worth reusing → `obsidian/knowledge/fix-catalog.md`
   (symptom, fix, before → after, rule/observed); a reading that misled you →
   `obsidian/knowledge/pitfalls.md`; a skill that was wrong → edit it.

The bar: **ideal** on PC and mobile — no frame over 50 ms, ≤ 1 % dropped,
p99 ≤ 33 ms, cold and warm. Never add a fixed phone frame cap to get there.

Report the before and after verdicts with the config (and machine load) they
were taken under, what you changed, what you reverted, and what you did not fix
and why. Never report a win you did not re-measure; never trade visual weight
without screenshots and the client's sign-off.
