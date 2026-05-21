---
tags: [workflow, playbook, stable]
updated: 2026-05-21
---

# Workflow — Implement a New Page / Section

The repeatable playbook for building a page or section. The canonical fill-in
prompt template is [[generic-layout-prompt]] — copy it, fill the `[PLACEHOLDERS]`,
and hand it to an AI agent or follow it manually.

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
8. **Server-first.** Server Components by default; `"use client"` only at leaves.
9. **Accessibility.** Semantic HTML, keyboard operability, visible focus, `alt` text.
10. **Quality.** `yarn lint`, components < ~150 lines, conventional commit.

## Deliverables

- All components in their correct folders.
- The view file assembling them.
- Any new `globals.css` tokens (commented).
- Mock data file if needed.
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
