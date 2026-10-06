---
paths:
  - "src/app/**/*.tsx"
  - "src/views/**/*.tsx"
description: App Router conventions — routes delegate to views, Server Components by default
---

# Routing & views

Full note: `obsidian/frontend/routing.md` (ADR-0003)

> This is Next.js 16. APIs and file conventions differ from older knowledge —
> verify against the docs before writing routing code.

- **Routes delegate.** `app/**/page.tsx` is ~3 lines and imports only from
  `@/views/`. All UI logic lives in `src/views/<page>.tsx`.
- **Server Components by default.** Add `"use client"` only at leaves — event
  handlers, browser APIs, hooks, animation components. Never mark a layout, page
  or view `"use client"` to dodge a boundary; split a leaf wrapper instead.
- **Navigation:** `<Link>` from `next/link`, `useRouter` from `next/navigation`.
  `next/router` is the Pages Router — wrong here.
- **`middleware.ts` no longer exists in Next 16** — it is `proxy.ts`, exporting a
  `proxy` function, running on Node (no Edge runtime). Keep it thin: routing,
  rewrites, redirects, cookie presence. Not authentication logic.
- **Metadata** comes from `generateMetadata` / `generateViewport` in
  `src/utils/seo/generate-page-metadata.ts`. Add a `sitemap.ts` entry per new route.

- **Routes stay static.** No `headers()` / `cookies()` / `await isBot()` in a
  page, view or layout. `src/proxy.ts` routes robots to `app/robot-view/`
  (`<HomeView robot />`) — an animated route gets the same pair. No
  `loading.tsx` that returns `null` (it hides the page from non-JS crawlers).
  See `.claude/rules/seo-robot.md`.

Adding a route: `app/<route>/page.tsx` → `src/views/<route>.tsx` → follow
`obsidian/workflows/new-page.md`. Every `<Link>`ed route must exist —
a prefetched 404 fails Best Practices on every page.

The home view (`src/views/home.tsx`) ships empty — if the project is otherwise
empty, start there rather than scaffolding a new route.
