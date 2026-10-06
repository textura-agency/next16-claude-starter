---
description: Make the site behave on real phones — iOS toolbar, context loss, 120 Hz, menus, touch, gyroscope, first scroll, stills
argument-hint: [symptom-or-area?]
---

Harden for real phones: **$ARGUMENTS** (the whole site if empty — or the
symptom a reviewer reported, quoted).

Use the `mobile-device-qa` skill. Every item there passed Lighthouse and the
headless scroll test and was then found by a person on an iPhone, so:

1. `yarn build && yarn start`; `yarn qa:setup` once. Probes use a person's UA
   (the default headless UA gets the robot form) — and look at every screenshot.
2. **A reported symptom:** find its section in the skill (symptom → cause → fix
   → proof), reproduce it first with the named tool — if it is iOS-only and
   Chrome can't reproduce it, `node tools/qa/webkit-probe.mjs --url …`.
3. **A full sweep:** `ios-toolbar-probe.mjs` and `context-loss-probe.mjs` for any
   live scene; `fps-probe.mjs` (no fixed phone caps; motion dt-scaled for
   120 Hz); the mobile menu at 390×844 closed / mid-open / open / closing in
   light and dark scheme (dvh + safe area, portal under `<body>`, focus in and
   back); overflow at 320–430; split headlines; touch sliders; custom cursors
   off on touch; the first scroll after the loader; `resize-check.mjs`.
4. Fix one thing, prove it with the same probe (FAIL → PASS), then
   `node tools/qa/scroll-test.mjs --url …` and `node tools/qa/lighthouse.mjs
   --url …` — no regression in phone scroll, A11y/BP/SEO stay 100.
5. `.claude/scripts/verify.sh`, `yarn lint`, `npx tsc --noEmit -p .`, `yarn build`.

Gyroscope hero motion is opt-in — ask before adding it. Never remove a 3D scene
on mobile without the client's sign-off.

Report per item: cause, fix, the proof (tool + result), and what could only be
checked in emulation — then ask the client (or a teammate) to open a preview on their phone,
naming exactly what to try. New iOS lessons → `obsidian/knowledge/pitfalls.md`.
