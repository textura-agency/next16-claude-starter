---
tags: [frontend, stable]
updated: 2026-05-21
---

# Component Conventions

Rules for writing and placing components. This note is canonical.

## Placement

| Folder | What goes here |
|--------|----------------|
| `components/ui/` | Design-system primitives — stateless, no provider deps (Button, Input, Card) |
| `components/common/` | Shared infrastructure — may depend on providers (Cookie, Skeletons) |
| `components/animation/springs/` | Animation engine — `#do-not-modify` |
| `views/` | Page-level components — one file per route |
| next to the feature | Feature-specific components — **not** in `components/` |

See [[folder-structure]] for the full tree.

## Structure rules

- **Named exports only** — no default exports from component files.
- One component per file (unless tightly-coupled sub-components warrant an index).
- Always define and export a typed `interface ComponentNameProps`. **No `any`.**
- Use `forwardRef` when a component must expose a DOM ref.
- **Server Components by default.** Add `"use client"` only when required:
  event handlers, browser APIs, React hooks, or animation components.
- Never mark a layout/page `"use client"` to dodge a boundary — split a leaf
  client wrapper instead.
- Keep components focused and under ~150 lines; split when they grow.

## Data rules

- **No hardcoded content** inside components — text, numbers, media come from
  props or hooks.
- Placeholder data → `src/data/mocks/<page>.ts`, passed via props. Never import
  mock data into a component file directly.
- Every async-data component handles `loading` / `error` / `empty` with skeleton
  loaders mirroring the final layout — see [[components/common]].
- Data-fetching logic lives in custom hooks (`src/hooks/`), never in presentational
  components.

## Accessibility

- Semantic HTML — use `button`, `nav`, `main`, `article`, `section`… not `div`.
- ARIA labels on icon-only / ambiguous interactive elements.
- All interactive elements keyboard-operable, with visible focus
  (`focus-visible:` utilities).
- Images: meaningful `alt`; decorative images `alt=""`.

## Animation in components

Use the [[animation-system]] primitives. Pass the semantic element via `tag`.
Tailwind classes go on `className` / `innerClassName`, never into spring `from`/`to`.

## Code quality

- Run `yarn lint` before committing.
- Prefer early returns over nested conditionals.
- Comments explain *why*, never narrate *what*. No `console.log` in committed code.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`.

## Related

[[design-system]] · [[animation-system]] · [[new-page]] · [[templates/component-note]]
