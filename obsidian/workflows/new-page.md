---
tags: [workflow, playbook, stable]
updated: 2026-05-21
---

# Workflow — Implement a New Page / Section

The repeatable playbook for building a page or section. The canonical fill-in
prompt template is [[generic-layout-prompt]] — copy it, fill the `[PLACEHOLDERS]`,
and hand it to an AI agent or follow it manually.

> [!tip] Empty project? Start at the home view.
> The home view (`src/views/home.tsx`, route `/`) ships **empty**. If the project
> is empty and no other instructions are provided, **start developing in the home
> view on route `/`** rather than scaffolding a new route.

## Steps

1. **Get the design.** Collect the desktop + mobile Figma frames. Use the Figma
   MCP server to read exact measurements, colours, typography, spacing.
2. **Plan the route.** Add `app/<route>/page.tsx` (thin, delegates) — see [[routing]].
3. **Build the view.** Create `src/views/<page-name>.tsx`. The route imports only
   from `views/`.
4. **Break into components.** Reuse `components/ui/` & `components/common/` first.
   New primitives → `components/ui/`; feature pieces → next to the feature. Each
   gets a typed `interface ...Props`. See [[component-conventions]].
5. **Tokens before styles.** Every colour/spacing/type/radius value must reference
   a token in `globals.css`. Missing value? Add the token first (with a comment on
   its origin). See [[design-system]].
6. **Animate with the system.** Use [[animation-system]] primitives + [[text-engine]]
   for text. No CSS transitions/keyframes, no other libraries.
7. **Data via props/hooks.** No hardcoded content. Placeholder data →
   `src/data/mocks/<page-name>.ts`. Async data → custom hook + `loading`/`error`/
   `empty` skeleton states.
8. **Assets per section.** Put images/videos in `public/assets/<section>/` — one
   folder per section — and reference them by absolute path. See [[folder-structure]].
9. **Server-first.** Server Components by default; `"use client"` only at leaves.
10. **Semantic & accessible markup.** Follow [[html-semantics]] — one `<h1>`,
    proper landmarks, native elements, named controls, visible focus, `alt` text,
    semantic `tag` on animation components.
11. **Quality.** `yarn lint`, components < ~150 lines, conventional commit.

## Deliverables

- All components in their correct folders.
- The view file assembling them.
- Any new `globals.css` tokens (commented).
- Mock data file if needed.
- Section assets under `public/assets/<section>/` if any.
- A short summary: assumptions made, new tokens added & why, any Figma values that
  couldn't map to existing tokens (flag for design review).

> [!important]
> Updating an existing page? Preserve all existing logic. Keep diffs minimal and
> focused on the required change.

## Animation cheat-sheet

| Need | Use |
|------|-----|
| Reveal on scroll-into-view | `<Inview mode="once">` |
| Continuous scroll motion (parallax) | `<SpringTrigger mode="scrub">` |
| Snap at a scroll point | `<SpringTrigger mode="toggle">` |
| Hover effect | `<Hover>` |
| Heading / copy reveal | `<TextEngine>` → [[text-engine]] |

## Related

[[routing]] · [[component-conventions]] · [[design-system]] · [[animation-system]]
