---
tags: [frontend, stable]
updated: 2026-10-10
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

**Styling & motion** — ported to the project stack: Tailwind v4 on its own
`consent-*` tokens (which default to `background` / `foreground` — dark-mode
adaptive, no hardcoded hex), and `@react-spring/web` for all motion — `useTransition` drives the banner and
modal mount/unmount, `useSpring` drives the toggle knob. No CSS transitions.
The modal locks scroll through the Lenis [[smooth-scroll|scroll store]]
(`useScroll.stop()`), not `body` overflow.

### Brand the consent UI — every project, automatically

The starter's banner is neutral on purpose. **Whenever a site is built on the
starter, the consent banner and the preferences modal are dressed in that
project's style as part of the build** — nobody should have to ask. Do it as soon
as the project has its palette and type (the first page or section built from the
design), and re-check it whenever the palette changes.

1. **Re-point the consent tokens** in `globals.css` (Tier 2) at the project's
   own semantic tokens — never at a literal:

   | Token | Role | Typical source |
   |-------|------|----------------|
   | `--consent-surface` | Banner / modal background | the site's card or surface colour |
   | `--consent-text` | Title, body, borders (at `/10`), muted copy (at `/70`) | the site's text colour on that surface |
   | `--consent-action` | Primary button fill, toggle "on" | the site's primary button / accent |
   | `--consent-action-text` | Label on the primary button, toggle knob | the label colour on that button |
   | `--consent-radius` | Banner and modal corners | the site's card radius |
   | `--consent-radius-control` | Buttons, close button, category rows | the site's button radius |

2. **Typography** — the banner uses `font-sans` (the site's body font). If the
   site sets headings in a display face, give the banner title and the modal
   title that heading font utility and its tracking/leading tokens; button labels
   follow the site's button style (case, tracking, weight).
3. **Buttons** — `CookieButton` should look like the site's own buttons
   (primary + secondary/outline). If the project has a `components/ui` button,
   match its classes — or render it — rather than inventing a third style.
4. **Keep the shape**, not the look: the banner stays bottom-right (full-width
   with a 1rem gutter on phones), server-rendered, `data-cookie-banner`, motion
   on springs. Branding is colour, type, radius, border and shadow only — never a
   loader-gated entrance (it is the phone's LCP).
5. **Check it** — contrast AA for body copy at `/70` and the primary button label
   on `--consent-action`, in light **and** dark (`prefers-color-scheme: dark`).
   If the site has no dark theme, give the consent tokens fixed values so a
   dark-mode phone doesn't get a dark banner on a light site.

**Copy stays short.** Title "This website uses cookies"; the line under it is
exactly:

> We use cookies to keep the site working.
> See our cookie policy.

("cookie policy" links to `/privacy-policy`, which carries the cookies
section.) Don't grow it back into a paragraph — on a phone the banner is the
LCP element and more text makes it taller over the first screen. Brand voice may
reword the title; the detail lives in the preferences modal.

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
