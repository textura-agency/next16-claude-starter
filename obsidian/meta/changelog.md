---
tags: [meta, changelog]
updated: 2026-10-06
---

# Changelog

Chronological log of notable changes to **this project**. Newest first.
Human-curated — not a mirror of `git log`.

Log a change here when it would surprise someone returning in six months: a new
dependency, a new route or section, a convention bent, a bug whose cause is worth
remembering. Routine commits do not need an entry.

For *why* the conventions are what they are, see [[decisions-log]].

---

## Baseline — built from `next16-claude-starter` v0.1.0

What the starter ships, so the first project entry has something to diff against:

| Area | What is there |
|------|---------------|
| Framework | Next.js 16 App Router · React 19 · TypeScript · Yarn · Node ≥ 20.19 |
| Styling | Tailwind v4, CSS-only config, three-tier design tokens ([[design-system]]) |
| Motion | Vendored spring engine + `spring-text-engine`, shared rAF ticker, reduced-motion ([[animation-system]]) |
| Layout | Adaptive scaling grid — root font-size tracks the viewport ([[design-system]]) |
| Scroll | Lenis smooth scroll + Zustand scroll store ([[smooth-scroll]]) |
| Server | `app/api` route handlers, zod-validated env, `{ data }`/`{ error }` envelope ([[api-architecture]]) |
| SEO | Metadata generator, `robots.ts`, `sitemap.ts`, JSON-LD ([[seo-metadata]]) |
| Agent harness | 8 commands, 7 path-scoped rules, 11 skills, 4 subagents, `verify.sh` ([[agent-harness]]) |
| Not included | CMS, database, auth, payments, i18n, tests — added per project ([[backend/README]]) |

The home view (`src/views/home.tsx`, route `/`) ships empty on purpose — start
there ([[new-page]]).

<!-- Log this project's changes below, newest first, under a `## YYYY-MM-DD` heading. -->

## 2026-10-06 — The starter inherits lessons from many production sites

What 50+ production sites built from this starter taught — measured, optimised
and reviewed on real phones — is now part of the starter. Reasoning:
[[decisions-log]] ADR-0026.

- **New `knowledge/` section.** [[fix-catalog]] — every fix that moved a measured
  number, by area (LCP/load, hydration/TBT, CLS, scroll, 3D/WebGL, fonts/media,
  accessibility, SEO/robots/metadata, phones/iOS), each with symptom, cause, fix,
  before → after and *rule* (≥ 3 sites) or *observed* (1–2) status; it ends with
  the starter defaults that must not be undone. [[pitfalls]] — measurement,
  tooling, code and design-to-code traps. [[knowledge/README]] — how to use them
  and the evidence rules for adding to them; [[templates/fix-entry]].
- **New workflows.** [[testing-pipeline]] — build → `next start` → Lighthouse ×3
  PC + mobile (people + robot form) → scroll test PC + mobile (cold + warm) →
  mobile/iOS probes → axe sweep → real host → real device, with the bars:
  Performance ≥ 90 on PC and mobile, A11y/BP/SEO 100, scroll ideal (no frame
  > 50 ms). [[mobile-device-qa]] — the companion to the new `mobile-device-qa`
  skill (`/mobile`): Safari's toolbar resize, 120 Hz and dt, no phone frame caps,
  WebGL context loss, menus (dvh + safe area + dark mode), touch, gyroscope,
  loader and first scroll, stills, WebKit, the device walk.
- **Workflows updated** to the evolved practice and linked to the knowledge:
  [[optimize-load]] (the bars, the levers in the order they pay),
  [[optimize-performance]] (the scroll test's cause column → fix table),
  [[optimize-3d-scene]] (§3 prewarm against real targets; §5 **no fixed phone
  cap** + desktop 60 fps draw cap — replaces the 30/45 fps budgets; §13 never stop
  a visible canvas, context recovery; the starter's new scene helpers),
  [[qa-verification]] (layers 3 and 4: the `tools/qa/` checks and a real phone),
  [[seo-aeo]] (robot form, origin, empty `loading.tsx`, SEO 100 hiding real
  defects), [[ship]] (the new budget and post-deploy checks), [[new-page]]
  (build-it-fast defaults), [[ai-agent-guide]] and [[agent-harness]] (the new
  skill, command and `tools/qa/` scripts).

## 2026-09-30 — Dependency refresh: Next 16.3.7, React 19.3

Bumped to pick up upstream Turbopack fixes in the 16.3.x patch line.

- `next` + `eslint-config-next` 16.3.1 → 16.3.7
- `react` / `react-dom` 19.2.8 → 19.3.0 (and `@types/react*` → 19.3.0)
- `zod` 4.4.3 → 4.6.5 · `@types/node` → 24.19.0
- Still held back (see [[tech-stack]] § Deliberately held back): ESLint 10,
  TypeScript 7, `@types/node` 26.
- Installs must run on the `.nvmrc` Node (24.16.0); Yarn rejects Node < 20.19
  via `engines`.

## 2026-09-18 — `optimize-load`: Lighthouse as a measured workflow

- **New skill `optimize-load`** + `/load` command + [[optimize-load]]. Audits all
  four Lighthouse categories across **laptop, tablet and mobile**, medians of 3+
  runs, then fixes what the audit blames and re-measures. Hard rule 13 now routes
  by *which half* is slow — load → `optimize-load`, scroll jank after load →
  `optimize-performance` — because Lighthouse never scrolls and cannot see the
  second.
- **`references/runner.md`** carries the Lighthouse Node-API runner (three form
  factors, medians, per-audit failures by weight), a `PerformanceObserver` CLS
  probe — Lighthouse routinely reports shifts with **no node attached** — and the
  WCAG contrast arithmetic.
- **`references/fixes.md`** carries the fixes by weight (TBT 30 · LCP 25 · CLS 25),
  the LCP phase-breakdown table that names which fix applies, the measured
  contrast floors (**0.55 black on light, 0.46 white on black**), and the
  width-reservation pattern for figures that count up.
- **Findings worth carrying between projects**, all recorded: a single run is an
  anecdote (LCP swung 2.7→4.6s on an unchanged build); axe samples animated pages
  mid-reveal and reports artifacts; CLS sums distance, not frames, so speeding an
  animation up does nothing; and a CLS of 0 may just mean the trace ended early.
- **Ownership tidied so the skills cannot drift** — `seo-audit` §5 and
  [[seo-aeo]] now delegate Core Web Vitals to `optimize-load` instead of
  restating them (they were still advising a single Lighthouse run on one
  profile).
- **The ship gate now routes through it** — [[ship]] and the `ship-check` skill
  ask for all four categories ≥ 90 on all three profiles, medians of 3+, and name
  `optimize-performance` as the second pass Lighthouse cannot do.
- **No new dependency** — both scripts install into a scratch directory.
- See [[decisions-log]] ADR-0025 for why this is a second skill rather than an
  extension of the first.


## 2026-09-17 — performance becomes a measured workflow

- **New skill `optimize-performance`** + `/perf` command + [[optimize-performance]].
  Performance work now runs a loop — build, measure in real Chrome, attribute,
  fix one thing, re-measure — instead of applying a checklist. Hard rule 13 in
  `AGENTS.md` routes any "it's slow / janky / stutters" request into it; the old
  3D rule moved to 14.
- **The diagnostic it adds:** scroll the whole page twice and compare cold
  against warm. A page that stutters on the *first* pass and is smooth after is
  not slow — it is fetching and decoding lazy media inside the frames a reveal
  animation is running in. Lighthouse cannot see this (it never scrolls), and
  neither can you by hand, because you have already warmed the page.
- **References:** `references/measuring.md` carries the scroll bench (real wheel
  events over CDP, `requestAnimationFrame` deltas, long tasks, resource timing)
  and how to read it; `references/fixes.md` carries the fixes, most-likely first,
  including a `warmMedia` implementation with the four traps that make a naive
  version silently do nothing.
- **No new dependency** — the bench uses `playwright-core` installed in a scratch
  directory, not in the project.
- See [[decisions-log]] ADR-0024 for why this is a loop rather than a checklist.


## 2026-09-08

**`optimize-3d-scene` skill — resize no longer switched off on touch.** §13 of
the skill (and `patterns.md` §5 / §14) told agents to attach *no* `resize`
listener on the mobile tier, to dodge the iOS URL bar. That also removed the
only path that could react to a breakpoint drag, a rotation or DevTools
emulation being turned off, so a scene loaded as a phone kept its phone
framebuffer, frame budget, parked pointer and hidden desktop passes on a desktop
viewport and rendered skewed. The skill now listens on every tier, ignores
height-only changes on a coarse pointer, and re-reads the tier on a width
change or a pointer-media-query flip, with a `retune()` that re-applies DPR,
budget, visibility, draw range and pointer binding without compiling a program.
§2 and §11 of `SKILL.md` and the [[optimize-3d-scene]] workflow note were
updated to match; §14 gained a tier-switch round-trip check. Reasoning in
[[decisions-log]] ADR-0023. Measured on the project that surfaced it: phone
390×844 / 3 draws ↔ desktop 2160×1350 / 4 draws, program count unchanged.
