---
tags: [meta, changelog]
updated: 2026-09-08
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
