---
tags: [frontend, stable]
updated: 2026-10-06
---

# Catalog — Common Components

Files in `src/components/common/` — shared infrastructure that may depend on
providers. Conventions: [[component-conventions]].

## Cookie — `Cookie/`

Self-contained cookie consent system — a bottom-right **banner** plus a full
category **preferences modal**. No third-party library (the old
`react-cookie-consent` dependency was removed). Lives in `src/components/common/Cookie/`.

| File | Role |
|------|------|
| `Cookie.tsx` | Mount component — hydrates the store, renders banner + modal |
| `LazyCookie.tsx` | Client wrapper — **static import** (server-rendered banner) + the robot-form gate (layout effect on `isRobotView()`) |
| `consent-flag.ts` | `CONSENT_STORAGE_KEY` + `CONSENT_FLAG_SCRIPT` — no `"use client"`, so the server layout inlines the string |
| `CookieBanner.tsx` | Bottom-right consent banner |
| `CookiePreferencesModal.tsx` | Category preferences dialog with per-category toggles |
| `CookieButton.tsx` | Local button primitive — `primary` / `secondary` variants |
| `cookieStore.ts` | Zustand store + `localStorage` persistence |
| `index.ts` | Barrel exports — `Cookie`, `LazyCookie`, `useCookieStore`, `CookieConsent` |

**Mounting** — the root layout renders `<LazyCookie />` inside `ScrollLayout`:
```tsx
import { LazyCookie } from "@/components/common/Cookie";
```

**Server-rendered — it is the phone's LCP element.** At phone width the
banner's paragraph is the largest text on screen. It used to mount client-only
(`dynamic({ ssr: false })`), so LCP waited for hydration — on every production
site measured (mobile 53 → 74, LCP 11.0 → 2.3 s on the cleanest A/B; *rule*,
10+ sites). Now:

1. `CookieBanner` renders in the server HTML, **at rest** (`useTransition({ initial: null })`),
   shown until hydration reads a stored choice (`!hydrated || consent === null`),
   marked `data-cookie-banner`.
2. `CONSENT_FLAG_SCRIPT` — the root layout's **first** `<body>` child — sets
   `<html data-consent>` when a choice is stored, before the banner is parsed
   (`<html suppressHydrationWarning>` tolerates the mark).
3. `globals.css` hides `[data-cookie-banner]` under `html[data-consent]` and on
   the robot form (`html:has(meta[name="x-robot-view"])`) — a returning visitor
   never sees it flash.

Check after any change: first visit shows it, Accept removes it, a reload has
it `display: none` at DOMContentLoaded, no console errors. Never hold it behind
an intro (`AfterPreload`-style gates): that is the LCP again, and changing when
consent is asked is a client decision.

**State** — `useCookieStore` (Zustand). `consent` is `null` until the user decides.
Persisted to `localStorage` under `CONSENT_STORAGE_KEY` (`cookie-consent-v1`).
Three categories: `necessary` (always on), `analytics`, `marketing`. ("Accept
all" used to save every category **off** — the same as "Reject all"; fixed.)

**Styling & motion** — ported to the project stack: Tailwind v4 with the
`background` / `foreground` design tokens (dark-mode adaptive, no hardcoded hex),
and `@react-spring/web` for all motion — `useTransition` drives the banner and
modal mount/unmount, `useSpring` drives the toggle knob. No CSS transitions.
The modal locks scroll through the Lenis [[smooth-scroll|scroll store]]
(`useScroll.stop()`), not `body` overflow.

> [!note] `#todo`
> The privacy-policy link points to `/privacy-policy`, which ships as a
> boilerplate route (`src/views/legal/`, copy in `src/data/mocks/legal.ts`,
> flagged `TODO(legal)`). Say what the site really collects and have counsel
> review it — and the consent copy — before launch. Never delete the link to
> dodge the 404: the consent flow promises that page.

## Grid — adaptive scaling (`grid/`)

The **adaptive scaling grid** keeps a rem-based layout proportional across every
viewport by scaling the root (`<html>`) font-size. Design in `rem` once, and the
whole UI scales as one unit. Lives in `src/components/common/grid/`.

| File | Role |
|------|------|
| `grid.config.ts` | Breakpoints + `FONT_BASE` — the single source of truth for the grid |
| `adaptive-grid.tsx` | `<AdaptiveGrid>` client component — drives the scale-up, renders `null` |
| `index.ts` | Barrel exports — `AdaptiveGrid`, `GRID_BREAKPOINTS`, … |

**How it works** — two halves cover the whole viewport range:

- **Scale down** (viewport ≤ 1920px) — `vw`-based `html { font-size }` media
  queries in `globals.css`. At each breakpoint's design base width the root
  font-size resolves to 16px; between breakpoints it tracks the viewport.
- **Scale up** (viewport > 1920px) — the `<AdaptiveGrid>` component sets an
  inline `html` font-size at runtime via [[hooks|`useAdaptiveGrid`]], so the
  design keeps growing (damped by `coef`) on large displays.

The `globals.css` media queries and `grid.config.ts` describe the same
breakpoints — **keep them in sync** (formula: `font-size = 16 * 100 / baseWidth vw`).

**Mounting** — the root layout renders `<AdaptiveGrid />` inside `ScrollLayout`:
```tsx
import { AdaptiveGrid } from "@/components/common/grid";
```
Mount it once. Props: `baseWidth` (defaults to the largest breakpoint) and
`coef` (0–1 scale-up damping, default `0.6666`).

> [!note]
> This replaced a `styled-components`-based scaling system that was dropped into
> `common/` — see [[decisions-log]] ADR-0008. `styled-components` is **not** a
> project dependency; the scale-down CSS lives in `globals.css` per [[design-system]].

## ReducedMotion — `reduced-motion.tsx`

`<ReducedMotion>` — a client leaf that calls react-spring's `useReducedMotion()`.
It watches the `prefers-reduced-motion` media query and toggles react-spring's
global `skipAnimation`, so every spring — and `spring-text-engine` — jumps to its
end state instead of animating. Renders `null`; mounted once in the root layout.
See [[animation-system]] and [[seo-metadata]].

## Robot form — `robot-view.tsx`, `robot-*.tsx`

`RobotProvider` / `useRobot()` / `<RobotView/>` / `isRobotView()` and the
resting twins of the engine's primitives (`robot-spring`, `robot-inview`,
`robot-hover`, `robot-text`). Full note: [[robot-form]].

## Origin sync — `origin-sync.ts`

`originSyncScript(siteConfig.url)` — inlined by the root layout; after
hydration it points canonical / share URLs at `location.origin` when the page
is served from a host other than the built one. See [[seo-metadata]] → Origin.

## Scene viewport — `scene-viewport.tsx`

`<SceneViewport>` — the fixed full-bleed box for a canvas, at the large
viewport height, deaf to the iOS toolbar. See [[webgl-scenes]].

## Skeleton loaders

Three skeleton components for `loading` states of async-data components — every
async component must mirror its final layout with one of these
(see [[component-conventions]]).

| Component | File | For |
|-----------|------|-----|
| `<SkeletonImage>` | `skeleton-image.tsx` | image placeholders |
| `<SkeletonLoader>` | `skeleton-loader.tsx` | generic block placeholders |
| `<SkeletonVideo>` | `skeleton-video.tsx` | video placeholders |

> [!note]
> `components/ui/` (design-system primitives) does not exist yet — create it when
> the first primitive is added. See [[folder-structure]].

## Related

[[component-conventions]] · [[components/animation-springs]]
