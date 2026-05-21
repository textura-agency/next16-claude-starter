---
tags: [moc, home]
updated: 2026-05-21
---

# 🧠 next16-claude-starter — Project Brain

This vault is the **single source of truth** for the `next16-claude-starter` project. It documents
how the project is built, why decisions were made, and how to extend it — for both
humans and AI agents (Claude Code, Cursor).

> [!info] What is this project?
> `next16-claude-starter` (package name `next16-claude-starter`) is a **Next.js 16 starter template**
> built by [Textura](https://textura.agency) for animation-heavy marketing & landing
> sites. Every motion is spring-based; there is no backend yet.

## 🗺️ Map of Content

### 00 — Meta
- [[meta/README|Meta overview]] — how to use and maintain this vault
- [[changelog]] — chronological log of notable project changes
- [[decisions-log]] — Architecture Decision Records (ADRs)

### 01 — Architecture
- [[system-overview]] — the big picture, request lifecycle, mental model
- [[tech-stack]] — every dependency and why it is here
- [[folder-structure]] — where everything lives and what belongs where
- [[data-flow]] — how state, scroll, and animation data move through the app
- [[environment-variables]] — config & secrets handling

### 02 — Frontend
- [[routing]] — App Router conventions, route → view delegation
- [[design-system]] — Tailwind v4 tokens, CSS layers, styling rules
- [[animation-system]] — the spring component library (the core of this starter)
- [[text-engine]] — `spring-text-engine` usage summary & project rules
- [[text-engine-reference]] — full `spring-text-engine` API reference
- [[smooth-scroll]] — Lenis integration + scroll store
- [[component-conventions]] — how to write & place components
- [[seo-metadata]] — metadata generation & bot detection
- [[components/animation-springs|Spring components catalog]]
- [[components/common|Common components catalog]]
- [[hooks]] — custom hooks catalog
- [[utils]] — utility functions catalog

### 03 — Backend
- [[backend/README|Backend overview]] — *not implemented yet (frontend-only starter)*

### 04 — Workflows
- [[new-page]] — playbook for implementing a new page/section
- [[generic-layout-prompt]] — fill-in prompt template for a new page/section
- [[ai-agent-guide]] — rules of engagement for AI agents working in this repo

### Templates
- [[templates/component-note|Component note template]]
- [[templates/hook-note|Hook note template]]
- [[templates/adr-note|ADR template]]

## 🏷️ Tag legend

| Tag | Meaning |
|-----|---------|
| `#stable` | Documented and reliable — safe to depend on |
| `#wip` | Work in progress / partially documented |
| `#todo` | Needs attention or is unfinished |
| `#decision` | Records or relates to an architectural decision |
| `#do-not-modify` | Code that must not be edited (animation engine) |

## 🔌 Obsidian setup

Open this folder (`obsidian/`) as an Obsidian vault. Recommended:
- **Graph view** — see how specs, components, and hooks connect
- **Dataview plugin** — query notes (e.g. list all `#wip` pages)
- **Templates core plugin** — point it at the `templates/` folder
