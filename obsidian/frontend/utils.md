---
tags: [frontend, stable]
updated: 2026-10-07
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
— the `Viewport` export (carries `themeColor`). Optional `absoluteTitle`,
`ogImageSize`, `noIndex`, `locale` let a CMS pass the whole `<title>`, an
uploaded image's size and an editor's noindex ([[cms-payload]]); all default to
the starter's behaviour. See [[seo-metadata]].

The metadata also carries the Search Console / Bing verification tags when
`siteConfig.verification` holds a code (env `GOOGLE_SITE_VERIFICATION`,
`BING_SITE_VERIFICATION`).

## `seo/structured-data.ts`

Typed JSON-LD builders — each returns a `JsonLdNode`; `jsonLdGraph(...nodes)`
wraps them into one document and `<JsonLd>` ([[components/common|common]])
renders it. Entities link by `@id` (`ORGANIZATION_ID`, `WEBSITE_ID`).

| Builder | Node |
|---|---|
| `getSiteStructuredData(overrides?)` | `Organization` (or a `LocalBusiness` subtype via `type`) + `WebSite` — root layout only. Facts from `siteConfig.organization` (founding date, email, phone, address, `sameAs`); overrides from a CMS's SEO defaults |
| `getBreadcrumbStructuredData(path)` | `BreadcrumbList` from the route registry's `parent` chain; `null` for `/` |
| `getArticleStructuredData(input)` | `BlogPosting` / `Article` / `NewsArticle` with a `Person` author, dates, publisher |
| `getServiceStructuredData(input)` | `Service` with `provider` → the Organization |
| `getFaqStructuredData(path, items)` | `FAQPage` — visible questions only; no Google rich result since May 2026 |
| `getPersonStructuredData(input)` | `Person` (`worksFor` → the Organization) |
| `getLocalBusinessStructuredData(input)` | one location: a `LocalBusiness` subtype with its own `@id`, address, hours, geo, map, `parentOrganization` → the brand |

`getSiteStructuredData` also emits `areaServed` / `hasMap`, and — for a
`LocalBusiness` `type` only — `openingHoursSpecification`, `geo`, `priceRange`
from `siteConfig.organization`.

`absoluteUrl(path)` resolves a path on `siteConfig.url`. See [[seo-metadata]]
and the `schema-markup` skill.

## `seo/hreflang.ts`

Client-safe (no `siteConfig`). `languageAlternates(path, versions, default?)`
→ the hreflang map with `x-default`, throwing at build time on an invalid
code or a set without the page itself; `routeLanguages(path)` reads it from
`ROUTES[].alternates`; `hreflangProblem(code)` explains a bad code;
`X_DEFAULT`. `generateMetadata` takes the result as `languages`, plus
`alternateLocales` for `og:locale:alternate`. Skill: `i18n-seo`.

## Adding a util

Keep utilities **pure** and side-effect-free (server-only ones like `isBot` are the
exception — note it clearly). Group by domain under `utils/<domain>/`.

## Related

[[hooks]] · [[seo-metadata]] · [[smooth-scroll]]
