---
tags: [meta, stable]
updated: 2026-05-21
---

# Meta — How this vault works

This is the `meta` section: documentation *about* the documentation.

## Purpose

The vault is the project's **second brain**. It exists so that any contributor —
human or AI — can understand how `next16-claude-starter` is built without reverse-engineering
the codebase. The code is the *what*; this vault is the *why* and *how*.

## Structure

```
obsidian/
├── README.md          ← vault home / Map of Content
├── meta/           ← docs about the docs, changelog, decisions
├── architecture/   ← system-level: stack, structure, data flow
├── frontend/       ← everything UI: routing, styling, animation, components
├── backend/        ← reserved — no backend exists yet
├── workflows/      ← repeatable playbooks & AI agent rules
└── templates/         ← note templates for new components/hooks/ADRs
```

## Conventions

- **Wikilinks** — link generously with `[[note-name]]`. A link to a not-yet-written
  note is fine; it marks something worth documenting later.
- **Frontmatter** — every note carries `tags` and an `updated` date.
- **Tags** — see the tag legend in the [[README|vault home]].
- **One concept per note** — keep notes focused and linkable.

## Maintenance rules

1. When a dependency changes → update [[tech-stack]] and add a [[changelog]] entry.
2. When an architectural choice is made → add an ADR to [[decisions-log]].
3. When a component/hook is added → document it and link it from the relevant catalog.
4. Keep [[frontend/animation-system]] in sync with `src/components/animation/` —
   that code is the heart of the starter.

## Source-of-truth note

This vault is **the single source of truth**. The repo root keeps only thin shims —
`AGENTS.md`, `CLAUDE.md`, `.cursorrules` — which carry the hard rules and point
here. The former `project-specs.md` was decomposed into the `architecture/` and
`frontend/` notes; the former `text-engine-docs.md` is now [[text-engine-reference]].
See [[ai-agent-guide]].
