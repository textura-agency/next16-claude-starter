---
name: schema-markup
description: Generate and wire valid JSON-LD structured data for pages in this starter — Organization, WebSite, LocalBusiness, Article, Product, FAQPage, BreadcrumbList, Service — using the existing structured-data helper rather than inline script tags. Use when the user asks for "schema", "structured data", "JSON-LD", "rich snippets", "FAQ schema", or wants richer search/AI results.
allowed-tools: Read, Grep, Glob, Edit, Write, WebFetch
---

# Structured data (JSON-LD)

This project already has `src/utils/seo/structured-data.ts`: typed builders
that each return a `JsonLdNode` — `getSiteStructuredData()` (Organization or a
LocalBusiness subtype + WebSite, rendered once by the root layout),
`getBreadcrumbStructuredData(path)` (from the route registry's `parent` chain),
`getArticleStructuredData`, `getServiceStructuredData`,
`getFaqStructuredData`, `getPersonStructuredData`,
`getLocalBusinessStructuredData` (one location of a multi-location business)
— plus `jsonLdGraph(...nodes)`
and `<JsonLd data>` (`src/components/common/json-ld.tsx`, escapes `<`).
**Use and extend those.** Never hand-write a
`<script type="application/ld+json">` in a component.

## First: what is the markup for?

Schema.org validity does not make a page eligible for a Google rich result.
Check Google's current supported-features gallery
(developers.google.com/search/docs/appearance/structured-data/search-gallery)
before promising one:

- **FAQ** rich results stopped showing on 7 May 2026 (docs removed in June).
- **HowTo** rich results were retired in 2023.
- **Sitelinks search box** (`WebSite` + `SearchAction`) was retired in 2024;
  `WebSite` still feeds the site name.

Those types may still *describe* matching visible content — answer engines
(ChatGPT, Perplexity, Claude) read them — but say so, and never sell them as a
rich-result win. A missing report in Search Console for a retired feature is
not a broken implementation.

Still worth it for Google: `Organization` (logo, knowledge panel facts),
`BreadcrumbList`, `Article`/`BlogPosting`, `Product` + `Offer`, `LocalBusiness`,
`Event`, `Review`/`AggregateRating` (on the reviewed thing only), `VideoObject`,
`JobPosting`.

## Rules

1. **JSON-LD only** — never microdata or RDFa (hard rule #10).
2. **Only describe what is on the page.** Schema that claims content the page
   does not contain is spam, and Google treats it that way.
3. **Reference, don't duplicate.** Build the graph with `@id` references between
   entities so the Organization is defined once and linked from everywhere.
4. Values come from `siteConfig` (`src/lib/site.ts` — `organization` holds the
   founding date, contact, address, `sameAs`, and the local facts
   `openingHours`, `geo`, `areaServed`, `priceRange`, `hasMap`), the route registry
   (`src/lib/routes.ts`) and the page's own props — never hardcoded a second
   time. Leave a fact out rather than guess one.
5. Validate: the JSON parses, required properties are present, URLs are absolute.
6. **No placeholder names.** The graph reads `siteConfig.name` — on sites built
   from the old starter the JSON-LD `Organization` said "New Project" while
   Lighthouse still scored SEO 100. `logo` points at the brand mark
   (`/icon-512.png` from the brand kit, or the logo file), never the starter's
   icon; `sameAs` lists only profiles the site actually links.
7. **The robot form carries the same graph.** Crawlers get `/robot-view` under
   `/` (`optimize-load/references/robot-path.md`); render JSON-LD from the root
   layout or the view so both forms emit it, and diff the two:
   `curl -s -A "Googlebot/2.1" <url>/ | grep -c 'application/ld+json'` equals
   the people count.
8. Absolute URLs come from `siteConfig.url`, which is the build-time origin —
   check the deployed graph names the real domain, not `localhost`.

## Types worth adding, by page kind

| Page | Type | Required-ish properties |
|------|------|------------------------|
| Home | `Organization`, `WebSite` | name, url, logo, sameAs |
| Local business | `LocalBusiness` subtype — `getSiteStructuredData({ type: "Dentist" })` | address, geo, openingHours, telephone (from `siteConfig.organization`; hours/geo/priceRange emit only for a LocalBusiness type) |
| One location of many | `getLocalBusinessStructuredData({ path, name, address, … })` | its own `@id` (`#location`), `parentOrganization` → the brand — skill `local-seo` |
| Blog post | `Article` / `BlogPosting` | headline, image, datePublished, dateModified, author |
| Service page | `Service` | serviceType, provider, areaServed |
| Product | `Product` + `Offer` | name, image, description, price, availability |
| FAQ block | `FAQPage` | mainEntity[] of Question/acceptedAnswer — answer engines only; no Google rich result since May 2026 |
| Any nested page | `BreadcrumbList` | itemListElement with position |
| Team page | `Person` per member | name, jobTitle, image, worksFor |

`FAQPage` no longer earns a Google rich result, but a real, visible FAQ is still
one of the formats answer engines extract most reliably — mark it up with
`getFaqStructuredData` when the questions are on the page, never schema-only.
The answer text must match the page exactly.

## Pattern

The site graph renders once in the root layout. A page's own graph renders in
its view — one `<JsonLd>` per page:

```tsx
const breadcrumb = getBreadcrumbStructuredData(PATH);
// …
<JsonLd data={jsonLdGraph(
  ...(breadcrumb ? [breadcrumb] : []),
  getServiceStructuredData({ path: PATH, name, description, serviceType }),
)} />
```

`src/views/legal/privacy-policy.tsx` ships the breadcrumb example. A type the
helper lacks → add a typed builder to `structured-data.ts` (input interface,
`@id` = `${absoluteUrl(path)}#<kind>`, `{ "@id": ORGANIZATION_ID }` for the
publisher/provider), then document it in `obsidian/frontend/utils.md`.

`yarn qa:seo` FAILs on JSON-LD that doesn't parse and on a robot form whose
block count differs from the people form.

## After

Note new schema in `obsidian/frontend/seo-metadata.md`, and validate with
Google's Rich Results Test / schema.org validator against the deployed URL.
(When auditing *another* site: `curl` and WebFetch can miss JSON-LD a CMS
plugin injects with JavaScript — check in a rendered browser before reporting
"no schema".)
