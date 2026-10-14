---
tags: [workflow, seo, stable]
updated: 2026-10-14
---

# Workflow — SEO & AEO

[[seo-metadata]] documents the *mechanism* (the metadata generator, robots,
sitemap, JSON-LD helpers). This note covers the *practice*: auditing, structuring
content, and being citable by answer engines. Skills: `seo-audit`,
`schema-markup`, `aeo-visibility`. Command: `/seo`. Agent: `seo-auditor`.
ADR: [[decisions-log]] ADR-0021, ADR-0028.

## Order of work

Indexability outranks everything. A perfectly optimised page that cannot be
crawled is worth nothing, so the audit always runs in this order:

1. **Indexability** — `robots.ts`, `sitemap.ts` coverage, canonicals (never
   localhost), no accidental dynamic rendering, **no content inside a `hidden`
   streaming segment** (curl as a bot)
2. **Metadata** — unique title/description per route, OG resolving absolutely
3. **Content structure** — one `<h1>`, real hierarchy, answer-first copy,
   descriptive internal links, alt text
4. **Structured data** — `Organization` + `WebSite` minimum
5. **Performance** — Core Web Vitals are a ranking factor; measure them with
   [[optimize-load]] (laptop, tablet and mobile, medians) rather than a single run
6. **AEO** — llms.txt, crawler policy, entity consistency

### Measure it — `yarn qa:seo`

Lighthouse's SEO score checks one page for the *presence* of tags.
`tools/qa/seo-crawl.mjs` reads the whole site the way a crawler does (served
HTML, no JS) and checks the *values*: robots.txt / sitemap / llms.txt agree and
name the real origin; every sitemap page 200 and indexable; unique, filled
titles ≤ 60 and descriptions 70–160; a self-referencing canonical; exactly one
`<h1>`; JSON-LD that parses; no internal link that 404s; no orphan; ≤ 3 clicks
deep; and the robot form (Googlebot) carrying the same title, description,
canonical, h1 and JSON-LD as the people form. Run it on the build and on the
deploy — zero FAILs is the bar ([[ship]]).

### The failure this project was most prone to

A hand-kept `sitemap.ts` array: routes added without an entry, and
`lastModified: new Date()` on every page every deploy. The sitemap, `/llms.txt`
and the breadcrumbs now read **one registry** (`src/lib/routes.ts`) and
`verify.sh` FAILs on a page without an entry ([[seo-metadata]] → The route
registry, [[new-page]] step 11).

## AEO — being quoted, not just ranked

Answer engines extract self-contained claims from crawlable text and weight
consistency of facts about an entity across the whole web. Practically:

- **Answer first.** Lead with the claim, then support it. Content that builds to a
  conclusion gets skipped.
- **Self-contained sentences.** "Our approach is faster" is unusable out of
  context; a sentence naming the subject survives extraction.
- **Specifics** — numbers, dates, named methods. Vague marketing copy is unquotable.
- **Comparison, definition, pricing and genuine FAQ pages** punch above their weight.
- **`/llms.txt`** — shipped: `src/app/llms.txt/route.ts`, from the route
  registry and `siteConfig.organization`, so it tracks real routes and facts.
- **Entity consistency** across site, JSON-LD, llms.txt and third-party profiles.

> [!important] Crawler policy is the user's decision
> "Be cited by AI" and "don't train on my content" are different goals served by
> different bots — training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`,
> `Google-Extended`), search/citation crawlers (`OAI-SearchBot`,
> `Claude-SearchBot`, `PerplexityBot`) and user-triggered fetchers
> (`ChatGPT-User`, `Claude-User`, `Perplexity-User`). `siteConfig.aiCrawlers`
> holds one switch per purpose and `robots.ts` names every crawler — ask before
> changing it, and check the CDN/WAF isn't blocking them on its own.

## What production taught

Measured or found on 50+ sites built from this starter ([[fix-catalog]] §8):

- **Lighthouse SEO 100 hides real defects.** 11 of 12 live sites served
  `http://localhost:3000` as canonical, `og:url` and sitemap `<loc>` while scoring
  100 — a canonical *exists*. Three sites scored 100 titled "New Project". Check the
  values, not the score: `curl -s <url>/ | grep -o 'rel="canonical"[^>]*'`, curl
  the `og:image` URL (200), read `/sitemap.xml`.
- **The origin is known at build time:** `NEXT_PUBLIC_SITE_URL` →
  `VERCEL_PROJECT_PRODUCTION_URL` → localhost. Reading the request host makes every
  route dynamic. A run-time sync to `location.origin` must run **after
  hydration** (before it, React inserted duplicate canonicals).
- **An empty `app/loading.tsx` hides the page from non-JS crawlers** (GPTBot,
  ClaudeBot, PerplexityBot): the route streams into `<div hidden>`. The starter
  ships without one; don't add one that renders `null`. Check:
  `curl -s -A GPTBot <url>/` — the `<h1>` must not sit under a `hidden` ancestor.
- **Robots get the robot form**: `src/proxy.ts` rewrites bot UAs — search
  engines, lab tools and **AI crawlers** — to a prerendered `/robot-view` of the
  same route: same content, metadata and canonical, no loader, no motion, the
  scene as a still. It keeps `/` static for people and gives PageSpeed a page at
  rest (robot mobile up to 54 → 100). Same content only — different content for
  crawlers is cloaking. Never `await isBot()` in a page.
- **Linked-but-missing routes cost Best Practices** — `<Link>` prefetches them
  (console 404). Build the page or point at a section hash.
- **Share cards:** 1200 × 630, the composed hero or a designed card, real brand
  title (≤ 60 chars), description from the site's copy, no placeholder handle —
  `yarn qa:brand`.

## Content at scale — the Payload kits

Where sites win long-tail search, and where thin, templated or orphaned pages
lose it. Both kits are in `payload-cms` (`scaffold.sh blog` / `collection`):

- **Blog** — posts / topics / authors at `/blog`: `BlogPosting` signed by a
  real `Person` with an author page, topic hubs (`noindex` until they hold 2
  posts), `revisedAt` as the only `lastmod`, old slugs → 308, `<h2>` anchors
  with a contents list, RSS, every post linked from the hub.
- **Data-driven pages** — one template, many pages (locations, services,
  integrations): a **quality bar** (own words + per-page facts) decides
  indexing, the admin says why a page is held back; `Service` /
  `LocalBusiness` / `FAQPage` by kind; "More in <group>" links so the set
  ranks as a set; maps linked, never embedded.

## Local, languages, and after launch

- **Local** — skill `local-seo`: the Google Business Profile is the main lever;
  NAP from `siteConfig.organization` only (hours, geo, area served, price
  range, map); one real page per location, never city-swapped copies.
- **Languages** — skill `i18n-seo`: subdirectories, `app/[lang]` with static
  params, the language from the URL (never `headers()`), bots never redirected
  by language, hreflang from `ROUTES[].alternates` (reciprocal, self, x-default;
  an invalid code fails the build), `yarn qa:seo` checks it served.
- **After launch** — `/seo-grow` with a Search Console export: striking
  distance, low CTR, decliners, cannibalisation → one change set per page,
  logged, re-measured on the same window 4–6 weeks later. **No win is reported
  without the comparison export.**

## What this project already has

`siteConfig` as the single source of truth (origin with the Vercel fallback,
organisation facts, AI-crawler policy, verification codes), the route registry
feeding `sitemap.ts`, `/llms.txt` and breadcrumbs, `generateMetadata`/`generateViewport`,
`robots.ts` with a named group per AI crawler, typed JSON-LD builders
(Organization/LocalBusiness, WebSite, BreadcrumbList, Article, Service, FAQPage,
Person, LocalBusiness per location) rendered by `<JsonLd>`, opt-in hreflang, `yarn qa:seo`, `yarn seo:grow`, the robot form behind `src/proxy.ts`, and an animation system
that only animates opacity/transform — so revealed content is in the DOM for
crawlers regardless. Keep it that way: branch on the robot form through the proxy
and `useMotionOff()`, never with `await isBot()` in a page, which costs static
rendering ([[seo-metadata]]).

## Honesty

Technical fixes remove obstacles; they do not guarantee rankings. AEO changes take
weeks to surface and vary between platforms and runs. Say so.

## Related

[[seo-metadata]] · [[html-semantics]] · [[fix-catalog]] · [[testing-pipeline]] · [[ship]] · [[site-migration]] · [[agent-harness]]
