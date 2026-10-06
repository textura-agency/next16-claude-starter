---
name: schema-markup
description: Generate and wire valid JSON-LD structured data for pages in this starter — Organization, WebSite, LocalBusiness, Article, Product, FAQPage, BreadcrumbList, Service — using the existing structured-data helper rather than inline script tags. Use when the user asks for "schema", "structured data", "JSON-LD", "rich snippets", "FAQ schema", or wants richer search/AI results.
allowed-tools: Read, Grep, Glob, Edit, Write, WebFetch
---

# Structured data (JSON-LD)

This project already has `src/utils/seo/structured-data.ts` →
`getSiteStructuredData()` producing an `Organization` + `WebSite` graph, rendered
once in the root layout. **Extend that helper.** Do not scatter inline
`<script type="application/ld+json">` tags through components.

## Rules

1. **JSON-LD only** — never microdata or RDFa (hard rule #10).
2. **Only describe what is on the page.** Schema that claims content the page
   does not contain is spam, and Google treats it that way.
3. **Reference, don't duplicate.** Build the graph with `@id` references between
   entities so the Organization is defined once and linked from everywhere.
4. Values come from `siteConfig` (`src/lib/site.ts`) and from the page's own
   props — never hardcoded a second time.
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
| Local business | `LocalBusiness` | address, geo, openingHours, telephone |
| Blog post | `Article` / `BlogPosting` | headline, image, datePublished, dateModified, author |
| Service page | `Service` | serviceType, provider, areaServed |
| Product | `Product` + `Offer` | name, image, description, price, availability |
| FAQ block | `FAQPage` | mainEntity[] of Question/acceptedAnswer |
| Any nested page | `BreadcrumbList` | itemListElement with position |
| Team page | `Person` per member | name, jobTitle, image, worksFor |

`FAQPage` earns its place twice over: it is the format both featured snippets and
AI answer engines extract most reliably. If the page has a real FAQ section, mark
it up — but the questions must be visible on the page, not schema-only.

## Pattern

Add a typed builder per entity in `structured-data.ts`, compose into the graph,
and keep the single render point in the root layout. When a page needs its own
graph, export a `generateStructuredData(props)` from the view and render it there
— still one script tag per page.

## After

Note new schema in `obsidian/frontend/seo-metadata.md`, and validate with
Google's Rich Results Test / schema.org validator against the deployed URL.
