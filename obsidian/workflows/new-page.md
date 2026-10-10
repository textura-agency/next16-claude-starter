---
tags: [workflow, playbook, stable]
updated: 2026-10-10
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

1. **Get the design.** Collect the desktop + mobile Figma frames and follow
   [[figma-to-code]] — fetch both `get_design_context` and `get_screenshot`,
   record node IDs, download and verify assets. Never build from a description.
2. **Plan the route.** Add `app/<route>/page.tsx` (thin, delegates) — see [[routing]].
3. **Build the view.** Create `src/views/<page-name>.tsx`. The route imports only
   from `views/`.
4. **Break into components.** Reuse `components/ui/` & `components/common/` first.
   New primitives → `components/ui/`; feature pieces → next to the feature. Each
   gets a typed `interface ...Props`. See [[component-conventions]].
5. **Tokens before styles.** Every colour/spacing/type/radius value must reference
   a token in `globals.css`. Missing value? Add the token first (with a comment on
   its origin). See [[design-system]].
   **First page of a project?** Brand the consent banner + preferences modal
   too — re-point the `--consent-*` tokens at the new palette and match the
   site's type and buttons ([[components/common|common]] → *Brand the consent
   UI*). It is on every page; leaving it neutral makes the site look unfinished.
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
11. **Route registered.** Add the route to `src/app/sitemap.ts` in the same
    change — the most common drift in this repo. See [[seo-aeo]].
12. **Build it fast from the start** — the defaults that 50+ production sites
    had to be fixed into ([[fix-catalog]]):
    - **Hero/LCP:** `priority` on the LCP image only; if a loader covers the
      first screen, the LCP copy is in the server HTML **at rest** (switch to the
      start state after a paint, then play the entrance); no image fetched by raw
      `public/` path — warm the `getImageProps` candidate.
    - **Below the fold:** text engines mount near the viewport; one clock per
      text effect rather than a spring per letter; hover only on fine pointers;
      **blur once per line, never per letter or word**.
    - **Loops:** every `loop:` spring and `await`-spring loop gated on
      `useMotionOff()` — otherwise the page hangs for reduced-motion visitors and
      on the robot form.
    - **Robot form:** anything that hides content until an animation plays needs
      a resting state there (same content, at rest); UI toggles (menus, modals)
      rest closed.
    - **Phone layout:** built in flow (not absolute from a 390 px frame); 1rem
      side padding; per-letter headings grouped in `nowrap` word spans; no
      horizontal overflow at 360–430 px.
    - **Menus/overlays:** `top-0 h-dvh` + safe-area bottom padding, their own
      colour token (check dark mode), scroll locked, focus managed.
    - **Scenes:** sized with `scene-viewport`, per-frame motion by dt, no phone
      frame cap — [[optimize-3d-scene]].
    - **Media:** fonts as Latin WOFF2 subsets via `next/font/local`; video H.264
      encoded per role (desktop / phone `<source media>`).
    - **Links:** every `<Link>` points at a route that exists, or a section hash.
13. **Verify.** `.claude/scripts/verify.sh`, `yarn lint`, `yarn build`, then the
    judgement pass in [[qa-verification]] — including `qa:resize`, `qa:motion`
    and `qa:axe` from [[testing-pipeline]]. On a phone before it's done
    ([[mobile-device-qa]]). Components < ~150 lines, conventional commit.

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

[[routing]] · [[component-conventions]] · [[design-system]] · [[animation-system]] · [[figma-to-code]] · [[qa-verification]] · [[fix-catalog]] · [[pitfalls]] · [[mobile-device-qa]] · [[ship]]
