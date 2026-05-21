# Agent Guide — next16-claude-starter

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. **Heed deprecation notices and verify against the
docs before writing routing or framework code.**

## Documentation lives in the vault

All project documentation is the **`obsidian/`** Obsidian vault — it is the
single source of truth for how this project is built.

**Before working, read:**
- `obsidian/README.md` — Map of Content (index of every doc)
- `obsidian/workflows/ai-agent-guide.md` — full rules of engagement
- The relevant topic note (e.g. `frontend/animation-system.md` before animation
  work, `workflows/new-page.md` before building a page)

Notes link each other with `[[wikilinks]]` — follow them to navigate.

## Hard rules (never violate)

1. **All motion is spring-based** — `@react-spring/web` via the components in
   `src/components/animation/springs/`. Text animation uses `spring-text-engine`.
   No CSS transitions, no CSS keyframes, no `framer-motion`.
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/` —
   they are the vendored animation engine.
3. **Never `mode="manual"`** on `TextEngine` — use `always` / `once` / `forward` /
   `progress`.
4. **No hardcoded values** — design tokens in `globals.css` for styles; props/hooks
   for content. No raw hex/px in class names.
5. **Routes delegate to views** — `app/**/page.tsx` imports only from `src/views/`.
6. **Server Components by default**; add `"use client"` only at the leaves.
7. **No `any`.** Type everything. Run `yarn lint` before finishing.
8. **Navigation** — standard `next/link` `<Link>` and `next/navigation` `useRouter`.

## After making changes

Update the vault: dependency changes → `tech-stack.md` + `changelog.md`;
architectural choices → an ADR in `decisions-log.md`; new component/hook/util →
the relevant catalog note.
