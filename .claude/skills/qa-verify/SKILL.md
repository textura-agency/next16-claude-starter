---
name: qa-verify
description: Verify built UI against this project's hard rules and against the design — runs the mechanical check script, then the judgement checks a script cannot make (visual fidelity vs Figma, token naming, motion choice, semantics, contrast through every frame of an entrance, responsive behaviour including live resizes, phone overflow and dark mode), and fixes what it finds in a loop until clean. Use after building or changing any page, view, section or component, before committing, and whenever the user says "QA this", "check my work", or "is this ready to ship".
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# QA & verification

Two layers. The script decides what is decidable; you decide the rest. Never
report "done" on the script alone — it cannot see a design.

Browser checks below use `tools/qa/` against a running `yarn build && yarn
start` (`yarn qa:setup` once; every tool takes `--url`; see
`tools/qa/README.md`). Probes need a person's UA — the default puppeteer UA gets
the robot form, which has no motion, no cursor and no scene, and "proves" a bug
gone that a person still sees. **Look at every screenshot a tool writes** (Read
the image) — numbers flag, the eye decides.

## Layer 1 — mechanical (always run first)

```bash
.claude/scripts/verify.sh          # whole src/
.claude/scripts/verify.sh src/views/about.tsx   # scoped
yarn lint
yarn build                          # must pass before anything ships
```

Every **FAIL** must be fixed. **WARN**s are judgement calls: fix or justify in
your summary, do not silently ignore them.

## Layer 2 — judgement checks

Work section by section. For each one:

### Design fidelity (only when a design exists)
Re-fetch the Figma node — do not QA from memory or from your own earlier summary.
`get_design_context` for values, `get_screenshot` for layout. Then compare:

- **Copy** — character for character. Flag anything paraphrased, shortened or invented.
- **Layout** — column count, flex direction, alignment, order, positioning.
- **Spacing** — margins, padding, gaps against the design values.
- **Typography** — size, weight, line-height, letter-spacing. Never assume a
  heading is bold; designs often use 400.
- **Colour** — exact values, resolved through tokens rather than matched by eye.
- **Images** — aspect ratio, crop, radius, overlap. No effects the design lacks.

If an image looks invisible or wrong, check the **container** first — an invented
wrapper background is the usual cause, not the asset itself.

### Tokens
- Every colour/spacing/radius/type value resolves to a token.
- New tokens follow the three-tier grammar and carry a comment naming their origin.
- No literal reached `@theme inline` or a Tier 2 token.
- The cookie banner and preferences modal match the site: `--consent-*` tokens
  point at the project's palette (not the neutral defaults once a brand exists),
  the type and buttons look like the site's, contrast passes light and dark, and
  the banner copy is still the two short lines — see
  `obsidian/frontend/components/common.md` → "Brand the consent UI".
- A value that had to be invented because the design has no token for it is
  **flagged to the user for design review**, not quietly added.

### Motion
- Everything scroll-driven, revealing, staggered or layout-affecting is a spring.
- CSS `transition-*` appears only for hover/focus/discrete state, with
  `duration-[var(--duration-*)]` and a token ease.
- Each primitive is the right one — `Inview` for reveals, `SpringTrigger` scrub
  for parallax, `Hover` for hover, text through the text engine.
- `tag` is semantic on every animation component.
- With `prefers-reduced-motion`, content is present and readable — and the page
  still responds: a `loop:` spring or `while (alive) await …` loop not gated on
  `useMotionOff()` restarts in the same tick forever under `skipAnimation` and
  hangs the tab (found on 6+ production sites). `node tools/qa/check-motion.mjs
  --url …` checks reduced motion and the robot form.
- Motion speed doesn't follow the refresh rate: per-frame increments are scaled
  by `dt` (a 120 Hz phone otherwise runs them 2×) — `mobile-device-qa` §120 Hz.
- Hover springs exist only where a mouse can hover; text reveals blur once per
  line, never per letter (`optimize-performance` §3).

### Semantics & a11y
- One `<h1>`; heading levels never skip; the outline reads as a document.
- Landmarks named; icon-only controls labelled; real `button` / `a`.
- Keyboard reachable, visible focus, logical tab order.
- Meaningful `alt`; decorative images `alt=""`.
- Contrast meets WCAG AA (4.5:1 body, 3:1 large text) **at every frame of the
  entrance**, not just at rest: `node tools/qa/axe-sweep.mjs --url …` samples
  contrast and target-size every ~120 ms from navigation. A first-screen fade
  sampled mid-way is a real Lighthouse failure — reveal with transform / clip /
  a mask sweep while opacity stays 1 (`optimize-load` §3). Its at-rest failures
  over a canvas are real even when Lighthouse says 100.
- Target size: 24 px centres, measured on the rendered boxes.
- Overlays (menu, modal): focus moves in when opened and back to the toggle on
  close, Escape closes, `aria-expanded` + `aria-controls`, the rest `inert`.

### Responsive
This project scales the root font-size with the viewport (the adaptive grid in
`globals.css`), so most sizing follows automatically. What still needs checking:

- No horizontal overflow at any width down to 320px:
  `document.documentElement.scrollWidth === innerWidth` at 320, 360, 390, 430.
  One over-wide section zooms the whole phone page out.
- Grid/flex reflow at each breakpoint; nothing cramped or orphaned.
- Touch targets ≥ 44px on mobile.
- Navigation collapses at the intended breakpoint.
- Text stays readable; nothing clipped by an `overflow` + tight leading combo.
  Split headlines never break mid-word ("DA/TA") — letters grouped in a
  `white-space: nowrap` word span.
- **Dark mode emulated.** Any overlay or menu on a theme token (`bg-background`)
  turns dark under `prefers-color-scheme: dark` while a fixed-colour page stays
  light — one menu read ~1:1 on a reviewer's dark-mode phone. Give overlays
  their own tokens.
- **Resize it live, both ways — not just fresh loads at each size.**
  `node tools/qa/resize-check.mjs --url … [--sel "<elements that
  matter>"]`: a real window jump, drag and widen; a DevTools device-preset switch
  and back (DPR, mobile and touch change together — how most reviewers check a
  phone); a Responsive-mode drag; tablet rotation. Each must land where a fresh
  load at that size does: every line "=", and LOOK at every strip — a box can
  match while what it draws is stale (a `<model-viewer>` box right, the model
  inside it still framed for desktop). Also by hand in `next dev`. Fix what it
  finds: sizes measured once on mount, DPR or pointer read once, a one-screen
  layout's scroll lock, camera framing, springs holding old targets.
- **Anything a phone shows changed** (menus, heroes, sliders, full-screen
  scenes, stills) → run `mobile-device-qa` — the iOS toolbar, 120 Hz, touch and
  safe-area checks a desktop browser never exercises.

### Architecture
- Route delegates to a view; view is a Server Component; `"use client"` at leaves.
- Content arrives via props/hooks — nothing hardcoded in a component.
- Async data has loading/error/empty states with skeletons.
- Components under ~150 lines, in the right folder, named export, typed props.

## The loop

1. Run layer 1, fix every FAIL.
2. Walk layer 2 section by section, fixing as you go.
3. Re-run layer 1 (fixes can introduce violations).
4. Repeat until clean.

## Report

State plainly: what failed and was fixed, what is a WARN you consciously kept and
why, any design values that could not map to tokens, and anything you could not
verify (no design available, no device to test on, iOS-only behaviour checked
only in emulation). Do not report a clean pass you did not achieve.
