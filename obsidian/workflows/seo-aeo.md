---
tags: [workflow, seo, stable]
updated: 2026-09-18
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

1. **Indexability** — `robots.ts`, `sitemap.ts` coverage, canonicals,
   `NEXT_PUBLIC_SITE_URL`, no accidental dynamic rendering
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

## What this project already has

`siteConfig` as the single source of truth, `generateMetadata`/`generateViewport`,
`robots.ts`, `sitemap.ts`, `Organization` + `WebSite` JSON-LD, and an
animation system that only animates opacity/transform — so revealed content is in
the DOM for crawlers regardless. Keep it that way, and prefer the
[[animation-system|ReducedMotion]] path over `isBot()` branching, which costs
static rendering and edges toward cloaking ([[seo-metadata]]).

## Honesty

Technical fixes remove obstacles; they do not guarantee rankings. AEO changes take
weeks to surface and vary between platforms and runs. Say so.

## Related

[[seo-metadata]] · [[html-semantics]] · [[ship]] · [[site-migration]] · [[agent-harness]]
