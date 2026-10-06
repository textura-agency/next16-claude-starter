---
tags: [frontend, stable]
updated: 2026-10-06
---

# Routing

Next.js 16 App Router. The defining convention: **routes delegate to views**.

> [!warning]
> Per `AGENTS.md`, this version of Next.js may differ from older knowledge. Heed
> deprecation notices before writing routing code.

## Route → View delegation

`app/**/page.tsx` files contain **no UI logic**. They import a component from
`src/views/` and render it. ADR: [[decisions-log]] ADR-0003.

```tsx
// src/app/page.tsx
import { HomeView } from "@/views/home";

export default function Home() {
  return <HomeView />;
}
```

All layout and UI logic lives in `src/views/home.tsx` (`HomeView`). The view is
a **Server Component**; isolate any client-only animation in a leaf component —
see [[component-conventions]] hard rule #6. `HomeView` currently ships **empty**:
if the project is empty and no other instructions are provided, start developing
here on route `/` (see [[ai-agent-guide]] / [[new-page]]).

## Current routes

| Route | File | View |
|-------|------|------|
| `/` | `src/app/page.tsx` | `views/home.tsx` → `HomeView` |
| `/robot-view` | `src/app/robot-view/page.tsx` | `HomeView robot` — reached only via the proxy's rewrite of `/` for robots ([[robot-form]]) |
| `/privacy-policy` | `src/app/privacy-policy/page.tsx` | `views/legal/` → `PrivacyPolicyView` (boilerplate, `TODO(legal)`) |

## Special files

`src/app/` carries the App Router special files:

| File | Role |
|------|------|
| `layout.tsx` | Root layout — provider tree, font, `metadata` + `viewport`, JSON-LD |
| ~~`loading.tsx`~~ | **Deliberately absent.** Even one that returns `null` wraps the route in Suspense; the server streams the page into `<div hidden>`, and crawlers that don't run JS read nothing. Add one per route only with a real skeleton, then re-curl as a bot |
| `manifest.ts` | `/manifest.webmanifest` from `siteConfig` |
| `error.tsx` | Route-segment error boundary (Client Component) |
| `not-found.tsx` | 404 page — served with a 404 status |
| `robots.ts` / `sitemap.ts` | Generate `/robots.txt` and `/sitemap.xml` — see [[seo-metadata]] |
| `api/<resource>/route.ts` | API endpoints (Route Handlers) — see [[api-architecture]] |
| `src/proxy.ts` | **Replaces `middleware.ts`** — see below. Ships with the robot-form rewrite (`matcher: ["/", "/robot-view"]`). |

## `middleware.ts` is gone — it is `proxy.ts`

Next.js 16 renamed it: the file is `proxy.ts` and the exported function is
`proxy`. It runs on **Node**; the Edge runtime is not supported and cannot be
configured. This is exactly the kind of breaking change `AGENTS.md` warns about —
training data will confidently write `middleware.ts`, and
`.claude/scripts/verify.sh` FAILs if it finds one.

The starter's proxy reads the user agent and rewrites robots on `/` to
`/robot-view` — that is how a route can serve robots differently **and stay
static**: never read `headers()` in a page for it. See [[robot-form]].

Keep it thin, per Next's own guidance: routing, rewrites, redirects, and cheap
cookie checks. Not authorisation — that belongs in the data layer (for Supabase,
RLS; see [[database-supabase]]). Every matched route runs Node before serving, so
keep the `matcher` tight or static marketing pages get dragged through it.

## Adding a route

1. Create `src/app/<route>/page.tsx` — keep it ~3 lines, delegate to a view.
2. Create `src/views/<route>.tsx` — the actual page component.
3. Use route groups `app/(feature)/` to scope feature pages without affecting the URL.
4. Follow the [[new-page]] playbook.

## Layouts

- `src/app/layout.tsx` — the **root layout**. Holds the provider tree
  (`ScrollLayout` → `AdaptiveGrid` / `ReducedMotion` / `Cookie` → children),
  loads the Onest font and `globals.css`, exports `metadata` + `viewport`, and
  renders the JSON-LD script. See [[data-flow]].
- Reusable layout *wrappers* (not route layouts) live in `src/layouts/` —
  e.g. [[smooth-scroll|ScrollLayout]].

## Navigation

Use **standard Next.js navigation** — `<Link>` from `next/link` and `useRouter`
from `next/navigation`. ADR: [[decisions-log]] ADR-0005.

```tsx
import Link from 'next/link';
import { useRouter } from 'next/navigation';
```

> [!note]
> Earlier drafts of `generic-layout-prompt.md` referenced `<AnimLink>` /
> `useAnimRouter()`. Those were never built and the convention is dropped — use
> `next/link` directly.

## SEO per route

Each route exports `metadata` via the shared generator — see [[seo-metadata]].

## Related

[[system-overview]] · [[component-conventions]] · [[new-page]] · [[qa-verification]]
