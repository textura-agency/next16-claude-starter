---
tags: [frontend, stable]
updated: 2026-10-06
---

# Catalog — Utilities

Pure helper functions in `src/utils/` (no side effects, unless noted).

## `bot-ua.ts`

`BOT_UA` / `isBotUserAgent(ua)` — the one list of crawlers, AI crawlers (GPTBot,
ClaudeBot, PerplexityBot, …) and lab tools (Lighthouse, PageSpeed). Read by
`src/proxy.ts` (the robot form) and `isBot()`. See [[robot-form]].

## `is-bot.ts`

`isBot(): Promise<boolean>` — **server-only**, reads `headers()`, which makes
the calling route **dynamic** for every visitor. Never in a page, view or
layout — the proxy routes robots. Route handlers only. See [[seo-metadata]].

## `warm-image.ts` — `warmImage`

`warmImage(spec): Promise<HTMLImageElement>` — downloads and decodes exactly
the candidate a rendered `<Image>` with the same `spec` will pick
(`getImageProps` → `sizes`, `srcset`, then `src`). Use it wherever code fetches
an image itself: a preloader, a reveal, a canvas/WebGL texture, a
`new Image()`. A raw `/assets/x.png` downloads the source file — measured on
four production sites: page 11.5 → 0.57 MB and hosted mobile LCP 31 → 3.7 s; a
canvas reveal 2,776 → 20 KB. *Rule.* CSS backgrounds: the same `getImageProps`
`srcSet`, written as `image-set(url(…) 1x, url(…) 2x)`. Warm below-the-fold
media after `load`, in idle time.

## `stable-viewport.ts`

`subscribeStableViewport` / `getStableViewportHeight` / `isTouchViewport` — a
viewport height that ignores the iOS toolbar (re-measured on touch devices
only when the width changes). Powers `<SceneViewport>`; see [[webgl-scenes]].

## `scroll-to.ts`

`scrollTo(id?, immediate?)` — programmatic scroll to an element id (string) or a
numeric position. Integrates with the Lenis [[smooth-scroll|scroll store]];
temporarily disables scroll state during the animation. Has `//if lenis` guards so
the Lenis dependency can be stripped if smooth scroll is removed.

## `math.ts`

| Export | Purpose |
|--------|---------|
| `SpringValues` | `Record<string, string \| number>` — the shape `from`/`to` take on every spring component |
| `transformRange(value, min, max, newMin, newMax)` | remap a value between ranges (clamped) |
| `lerp(start, end, t)` | linear interpolation |
| `debounce(fn, delay)` | debounce helper — **currently unused**; `useWindowSize` has its own inline timer |
| `interpolate(from, to, progress)` | interpolate a whole `SpringValues` bag, preserving CSS units and transform functions (`"10px"`, `"45deg"`, `"translate(10px)"`) |

`interpolate` is the scrub engine's workhorse — [[hooks|useSpringTrigger]] calls it
every frame in `mode="scrub"`. It is the one util inside the animation hot path, so
changes here are felt everywhere.

> [!note] Typed in the 2026-08-18 pass
> These signatures used `any` (a hard rule #7 violation, caught by
> `.claude/scripts/verify.sh` on its first run). `interpolate` now takes and
> returns `SpringValues`, which is exactly what its only caller already declared;
> `extractNumber` takes `unknown` and narrows by `typeof`; `debounce`'s generic
> constraint uses `(...args: never[]) => void`, the strict-safe idiom for
> "any function". No runtime behaviour changed.

## `lvh.ts`

CSS-string builders for viewport-height units with fallbacks
(`vh` → `lvh` → `calc(var(--vh) …)`): `heightLvh`, `minHeightLvh`, `marginTopLvh`,
`marginBottomLvh`. Solves mobile-browser viewport-height inconsistencies.
`lvh` is right for a scene box and wrong for UI with something at its bottom (a
menu's CTA hides under the iOS toolbar) — that takes `dvh` + the safe area
([[mobile-menus]]).

## `animation/coords.ts`

Element-coordinate helpers — `getElementCoords`, `getScrollCoordsFromElement` —
used internally by the scroll/animation system. Marked `@ts-nocheck`. `#do-not-modify`

## `seo/generate-page-metadata.ts`

`generateMetadata(props?)` — shared page-`Metadata` builder. `generateViewport()`
— the `Viewport` export (carries `themeColor`). See [[seo-metadata]].

## `seo/structured-data.ts`

`getSiteStructuredData()` — builds the `Organization` + `WebSite` JSON-LD graph
rendered by the root layout. See [[seo-metadata]].

## Adding a util

Keep utilities **pure** and side-effect-free (server-only ones like `isBot` are the
exception — note it clearly). Group by domain under `utils/<domain>/`.

## Related

[[hooks]] · [[seo-metadata]] · [[smooth-scroll]]
