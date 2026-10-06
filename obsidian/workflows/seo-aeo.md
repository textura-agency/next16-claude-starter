---
tags: [workflow, seo, stable]
updated: 2026-10-06
---

# Workflow — SEO & AEO

[[seo-metadata]] documents the *mechanism* (the metadata generator, robots,
sitemap, JSON-LD helpers). This note covers the *practice*: auditing, structuring
content, and being citable by answer engines. Skills: `seo-audit`,
`schema-markup`, `aeo-visibility`. Command: `/seo`. Agent: `seo-auditor`.
ADR: [[decisions-log]] ADR-0021.

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

### The failure this project is most prone to

`src/app/sitemap.ts` is a hand-maintained array. Adding a route without adding a
sitemap entry is the single most common miss here — cross-check
`find src/app -name 'page.tsx'` against it during any audit, and add the entry in
the same change as the route ([[new-page]] step 2).

## AEO — being quoted, not just ranked

Answer engines extract self-contained claims from crawlable text and weight
consistency of facts about an entity across the whole web. Practically:

- **Answer first.** Lead with the claim, then support it. Content that builds to a
  conclusion gets skipped.
- **Self-contained sentences.** "Our approach is faster" is unusable out of
  context; a sentence naming the subject survives extraction.
- **Specifics** — numbers, dates, named methods. Vague marketing copy is unquotable.
- **Comparison, definition, pricing and genuine FAQ pages** punch above their weight.
- **`/llms.txt`** served from a Route Handler so it tracks real routes.
- **Entity consistency** across site, JSON-LD, llms.txt and third-party profiles.

> [!important] Crawler policy is the user's decision
> "Be cited by AI" and "don't train on my content" are different goals served by
> different bots — training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`,
> `Google-Extended`) versus search/citation crawlers (`OAI-SearchBot`,
> `Claude-SearchBot`, `PerplexityBot`). Ask before editing `robots.ts`.

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

## What this project already has

`siteConfig` as the single source of truth (origin with the Vercel fallback),
`generateMetadata`/`generateViewport`, `robots.ts`, `sitemap.ts`, `Organization` +
`WebSite` JSON-LD, the robot form behind `src/proxy.ts`, and an animation system
that only animates opacity/transform — so revealed content is in the DOM for
crawlers regardless. Keep it that way: branch on the robot form through the proxy
and `useMotionOff()`, never with `await isBot()` in a page, which costs static
rendering ([[seo-metadata]]).

## Honesty

Technical fixes remove obstacles; they do not guarantee rankings. AEO changes take
weeks to surface and vary between platforms and runs. Say so.

## Related

[[seo-metadata]] · [[html-semantics]] · [[fix-catalog]] · [[testing-pipeline]] · [[ship]] · [[site-migration]] · [[agent-harness]]
