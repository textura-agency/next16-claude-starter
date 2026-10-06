---
tags: [meta, stable]
updated: 2026-10-06
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
├── knowledge/      ← measured fixes and pitfalls from production sites
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
2. When an architectural choice is made → add an ADR to [[decisions-log]],
   continuing the existing numbering.
3. When a component/hook is added → document it and link it from the relevant catalog.
4. Keep [[frontend/animation-system]] in sync with `src/components/animation/` —
   that code is the heart of the starter.
5. When a fix moves a measured number, or a trap costs real time → an entry in
   [[fix-catalog]] or [[pitfalls]], by the evidence rules in
   [[knowledge/README]]: before → after under the same config; *observed* on 1–2
   sites, *rule* at 3. Promote a rule into its skill and workflow in the same
   change.

## Inherited vs. project content

Two notes behave differently from the rest when a project is started from this
starter:

- **[[decisions-log]]** ships **populated**. ADR-0001 … ADR-0026 explain why the
  starter's conventions exist, and notes across the vault link to them by number
  — so keep the numbers stable. Add your project's decisions on top. Amending an
  inherited decision is fine: write a new ADR saying so rather than editing the old.
- **[[changelog]]** ships **empty**, with a baseline entry describing what the
  starter provides. It logs *this* project's history, not the starter's.
- **[[fix-catalog]] and [[pitfalls]]** ship **populated** with what 50+
  production sites taught. Keep adding your project's measured fixes and traps;
  an entry that recurs in three projects is worth proposing upstream to the
  starter.

Everything else is written to be edited in place as the project diverges.

## Source-of-truth note

This vault is **the single source of truth**. The repo root keeps only thin shims —
`AGENTS.md`, `CLAUDE.md`, `.cursorrules` — which carry the hard rules and point
here. The former `project-specs.md` was decomposed into the `architecture/` and
`frontend/` notes; the former `text-engine-docs.md` is now [[text-engine-reference]].
See [[ai-agent-guide]].
