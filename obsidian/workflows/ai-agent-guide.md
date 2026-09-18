---
tags: [workflow, ai, stable]
updated: 2026-09-18
---

# AI Agent Guide

Rules of engagement for AI agents (Claude Code, Cursor) working in this repo.

## Read this first

> [!warning] This is NOT the Next.js you know
> `AGENTS.md` warns that this version of Next.js has breaking changes — APIs,
> conventions, and file structure may differ from training data. **Read the
> relevant spec before writing code. Heed deprecation notices.**

> [!tip] Where to start
> The home view (`src/views/home.tsx`, route `/`) ships **empty**. If the project
> is empty and no other instructions are provided, **start developing in the home
> view on route `/`**. Follow [[new-page]] to build it out.

## Source-of-truth hierarchy

| Layer | Files | Purpose |
|-------|-------|---------|
| **This vault** (`obsidian/`) | all of `obsidian/**` | **The single source of truth** — all project documentation, navigable & linked. |
| **AI entry points** (repo root) | `AGENTS.md`, `CLAUDE.md`, `.cursorrules` | Thin shims — they carry the hard rules and point into the vault. |
| **Execution layer** | `.claude/**` | Commands, path-scoped rules, skills, agents, hooks and `verify.sh` — see [[agent-harness]]. |

There are no separate spec files anymore — `project-specs.md` was decomposed into
the vault's `architecture/` and `frontend/` notes, and `text-engine-docs.md`
became [[text-engine-reference]]. **The vault is canonical**; keep the root shims
consistent with it.

## Hard rules (never violate)

1. **No CSS keyframes, no `framer-motion`.** All motion uses `@react-spring/web`
   via the [[animation-system]]. Text uses [[text-engine]]. CSS `transition-*` is
   allowed **only** for simple discrete state changes (hover/focus colour,
   opacity, border) with token-backed timing — ADR-0014, see [[design-system]].
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/`
   without explicit sign-off. They are the vendored animation engine —
   `#do-not-modify`. One authorized performance refactor has been made; see
   [[decisions-log]] ADR-0009. They stay protected by default.
3. **Never `mode="manual"`** on `TextEngine` — use `always`/`once`/`forward`/`progress`.
   Its container is flex: pair `text-*` with `justify-*` to align it, and keep
   leading ≥ 1.1 (`leading-display`) whenever `overflow` is set. See [[text-engine]].
4. **No hardcoded values** — design tokens for styles, following the strict
   three-tier naming convention (see [[design-system]]); props/hooks for content
   (see [[component-conventions]]).
5. **Routes delegate to views.** `app/**/page.tsx` imports only from `views/`.
6. **No `any`.** Type everything. Run `yarn lint` before finishing.
7. **Server Components by default**; `"use client"` only at leaves.
8. **Anything slow → measure, never guess.** Build, measure, attribute, fix one
   thing, re-measure; never report a performance win you did not measure.
   Lighthouse scores, Core Web Vitals, accessibility and SEO → the
   `optimize-load` skill ([[optimize-load]]). Scroll jank and micro-freezes after
   the load → `optimize-performance` ([[optimize-performance]]); check first
   whether the *first* scroll is worse than the second.
9. **Performance request + a three.js/WebGL scene in the project → invoke the
   `optimize-3d-scene` skill first.** It owns the order of fixes; don't improvise
   one. See [[optimize-3d-scene]].
10. **Verify before reporting done.** Run `.claude/scripts/verify.sh` plus
   `yarn lint` and `yarn build` after any code change, and the `qa-verify` skill
   after any UI change. Zero FAILs, or say explicitly what you left and why.
   See [[qa-verification]].

## Where to look

| Question | Note |
|----------|------|
| How is the project structured? | [[system-overview]], [[folder-structure]] |
| What's in the stack? | [[tech-stack]] |
| How do I add a page? | [[new-page]] |
| How does animation work? | [[animation-system]], [[text-engine]] |
| How do I style something? | [[design-system]] |
| What components/hooks/utils exist? | [[components/animation-springs]], [[components/common]], [[hooks]], [[utils]] |
| Lighthouse / Core Web Vitals / "get it in the green"? | [[optimize-load]] |
| The site feels slow / janky / stutters on scroll? | [[optimize-performance]] |
| The 3D scene lags / needs optimising? | [[optimize-3d-scene]] |
| How do I check my work? | [[qa-verification]] |
| A Figma design needs building | [[figma-to-code]] |
| Content needs to be editable | [[cms-payload]] |
| The project needs a database | [[database-supabase]] |
| SEO / AI visibility | [[seo-aeo]] |
| Is it ready to launch? | [[ship]] |
| Rebuilding an existing live site | [[site-migration]] |
| What can Claude Code run here? | [[agent-harness]] |
| Why was X decided? | [[decisions-log]] |

## After making changes

- New dependency → update [[tech-stack]] + [[changelog]].
- Architectural choice → add an ADR to [[decisions-log]].
- New component/hook/util → document it in the relevant catalog note.

## The execution layer (`.claude/`)

Full map: [[agent-harness]]. Skills, rules, agents and commands are **registered in
this vault** so the routing is discoverable to any agent or human reading the docs.

**Commands** — `/new-page` · `/section` · `/qa` · `/ship` · `/cms` · `/db` ·
`/seo` · `/migrate-site` · `/perf` · `/load`

**Skills** — `qa-verify`, `figma-to-section`, `payload-cms`, `supabase-db`,
`supabase-auth`, `seo-audit`, `schema-markup`, `aeo-visibility`, `site-migration`,
`ship-check`, `optimize-load`, `optimize-performance`, `optimize-3d-scene`

**Agents** — `section-builder`, `motion-reviewer`, `vault-librarian`, `seo-auditor`

**Rules** (`.claude/rules/`) auto-load when a matching file is read: `motion.md`,
`design-tokens.md`, `routing-views.md`, `api-env.md`, `engine-protected.md`,
`payload.md`, `supabase.md`.

> [!warning] Rules fire on **read**, not write
> A path-scoped rule enters context when Claude reads a matching file — not when
> it creates one, and not again after `/compact` until a match is read. Rules
> reinforce; they do not guarantee. Anything that must hold regardless belongs in
> `.claude/scripts/verify.sh` or a hook.

Registering something new means: drop it in `.claude/<kind>/`, add or extend a
vault note, link it from [[README]] and [[agent-harness]], and log it in [[changelog]].

## Automated enforcement (hooks)

This workflow is **enforced automatically** by Claude Code hooks in
`.claude/settings.json` — nobody has to remember to ask for it:

| Hook | Fires | Effect |
|------|-------|--------|
| `SessionStart` | new chat / resume | Injects a pointer to read this vault first |
| `UserPromptSubmit` | every request | Reminds the agent to consult the relevant guide, and to update docs for any change |
| `Stop` | end of every turn | Blocks once to confirm the vault was updated to match the turn's changes |

The `Stop` hook blocks **at most once per turn** — a `${TMPDIR}` marker keyed by
session id guarantees termination, so there is no infinite loop. To review, edit,
or disable the hooks run `/hooks`. ADR: [[decisions-log]] ADR-0007.
