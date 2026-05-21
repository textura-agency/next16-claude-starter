---
tags: [architecture, stable]
updated: 2026-05-21
---

# System Overview

## What this is

`next16-claude-starter` is a **frontend-only Next.js 16 starter** for building animation-heavy
marketing and landing pages. It ships with a complete spring-animation system, smooth
scrolling, SEO scaffolding, and cookie consent — ready to drop a design into.

There is **no backend, database, or auth** yet. See [[backend/README]].

## Mental model

```
Browser request
   │
   ▼
app/layout.tsx ──────────────► RootLayout
   │   loads Onest font, globals.css, metadata
   │
   ├─ <ScrollLayout>  ◄──── Lenis smooth scroll + Zustand scroll store
   │     │
   │     ├─ <LazyCookie/> ◄── cookie consent banner + modal (client, dynamic, no SSR)
   │     │
   │     └─ {children}
   │           │
   │           ▼
   │        app/page.tsx ──► delegates to ──► views/home.tsx (HomeView)
   │           │
   │           ▼
   │        composed UI = spring animation components + text engine
   │
   ▼
Rendered page — Server Components by default; "use client" only at animation leaves
```

## The three pillars

1. **Routing → Views.** `app/` files are thin; they delegate to `src/views/`.
   See [[routing]].
2. **Spring animation system.** Every motion uses `@react-spring/web` through a
   custom component layer. See [[animation-system]] and [[text-engine]].
3. **Smooth scroll.** Lenis drives a global `requestAnimationFrame` loop; scroll
   state is shared via a Zustand store. See [[smooth-scroll]].

## Request lifecycle

1. Next.js resolves the route under `app/`.
2. `RootLayout` wraps the page in `<ScrollLayout>` → `<LazyCookie/>` → `{children}`.
   The provider order is fixed — see [[data-flow]].
3. The route file renders its **View** component.
4. The View composes animation primitives. These are all `"use client"`.
5. `<ScrollController>` (inside `ScrollLayout`) initialises Lenis on mount.

## Rendering strategy

- **Server Components by default.** `layout.tsx`, `page.tsx`, and SEO utilities run
  on the server.
- **`"use client"` only at the leaves** — animation components and views that use
  hooks. Never mark a layout/page client just to avoid a boundary.
- `isBot()` lets Server Components skip heavy animation for crawlers — see [[seo-metadata]].

## Key entry points

| File | Role |
|------|------|
| `src/app/layout.tsx` | Root layout, font, provider tree |
| `src/app/page.tsx` | Home route → `HomeView` |
| `src/views/home.tsx` | Demo view showcasing the animation system |
| `src/layouts/scroll-layout.tsx` | Lenis integration |
| `src/lib/springs/config.ts` | Global animation config |

## Related

[[tech-stack]] · [[folder-structure]] · [[data-flow]]
