---
description: Pre-launch gate — build, rules, SEO + robot form, measured load and scroll, real phones, a11y, secrets, deploy, retro
---

Run the full pre-launch gate using the `ship-check` skill.

Order: build + lint + `.claude/scripts/verify.sh` → `qa-verify` across every
route → `seo-audit` (no `TODO:` placeholders, brand kit, canonical on the real
domain, the robot form) → measured on the **deployed URL** with `tools/qa/`:
`lighthouse.mjs` and `--as-bot` (perf ≥ 90 mobile + desktop; A11y/BP/SEO 100,
people + robot), `scroll-test.mjs --first-scroll` (ideal on PC and phone), `axe-sweep.mjs`, `check-motion.mjs`
→ `mobile-device-qa` close-out (iOS toolbar, context loss, fps, menu, overflow,
WebKit) and a preview the client (or a teammate) opens on their phone → accessibility pass →
secret and env hygiene → deploy steps → retro.

If this project replaces an existing live site, the `site-migration` redirect map
must be complete and verified **before** launch — check it, and stop if it is not.

Report each gate as passed / failed-and-fixed / not-verified-because. Do not
report a pass you did not actually run. End with the retro: measured fixes →
`obsidian/knowledge/fix-catalog.md`, traps → `obsidian/knowledge/pitfalls.md`,
defects that came from the starter itself flagged as starter fixes.
