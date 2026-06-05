---
tags: [workflow, ai, stable]
updated: 2026-05-21
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

There are no separate spec files anymore — `project-specs.md` was decomposed into
the vault's `architecture/` and `frontend/` notes, and `text-engine-docs.md`
became [[text-engine-reference]]. **The vault is canonical**; keep the root shims
consistent with it.

## Hard rules (never violate)

1. **No CSS transitions/keyframes, no `framer-motion`.** All motion uses
   `@react-spring/web` via the [[animation-system]]. Text uses [[text-engine]].
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/`
   without explicit sign-off. They are the vendored animation engine —
   `#do-not-modify`. One authorized performance refactor has been made; see
   [[decisions-log]] ADR-0009. They stay protected by default.
3. **Never `mode="manual"`** on `TextEngine` — use `always`/`once`/`forward`/`progress`.
4. **No hardcoded values** — design tokens for styles (see [[design-system]]),
   props/hooks for content (see [[component-conventions]]).
5. **Routes delegate to views.** `app/**/page.tsx` imports only from `views/`.
6. **No `any`.** Type everything. Run `yarn lint` before finishing.
7. **Server Components by default**; `"use client"` only at leaves.

## Where to look

| Question | Note |
|----------|------|
| How is the project structured? | [[system-overview]], [[folder-structure]] |
| What's in the stack? | [[tech-stack]] |
| How do I add a page? | [[new-page]] |
| How does animation work? | [[animation-system]], [[text-engine]] |
| How do I style something? | [[design-system]] |
| What components/hooks/utils exist? | [[components/animation-springs]], [[components/common]], [[hooks]], [[utils]] |
| Why was X decided? | [[decisions-log]] |

## After making changes

- New dependency → update [[tech-stack]] + [[changelog]].
- Architectural choice → add an ADR to [[decisions-log]].
- New component/hook/util → document it in the relevant catalog note.

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
