---
tags: [frontend, stable]
updated: 2026-05-21
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

All layout and UI logic lives in `src/views/home.tsx` (`HomeView`).

## Current routes

| Route | File | View |
|-------|------|------|
| `/` | `src/app/page.tsx` | `views/home.tsx` → `HomeView` |

## Adding a route

1. Create `src/app/<route>/page.tsx` — keep it ~3 lines, delegate to a view.
2. Create `src/views/<route>.tsx` — the actual page component.
3. Use route groups `app/(feature)/` to scope feature pages without affecting the URL.
4. Follow the [[new-page]] playbook.

## Layouts

- `src/app/layout.tsx` — the **root layout**. Holds the provider tree
  (`ScrollLayout` → `Cookie` → children), loads the Onest font and `globals.css`,
  and sets metadata. See [[data-flow]].
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

[[system-overview]] · [[component-conventions]] · [[new-page]]
