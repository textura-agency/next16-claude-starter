---
name: seo-audit
description: Audit a page or the whole site for technical and on-page SEO — crawlability, metadata, heading outline, structured data, internal linking, Core Web Vitals, and the animation-specific crawlability risks this starter carries. Produces ranked findings and fixes them in code. Use when the user asks to "audit SEO", "check my SEO", "why isn't this ranking", "fix meta tags", or before a launch.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, WebFetch
---

# SEO audit

Audit the **code**, and the live URL when one exists. Rank findings by impact and
fix them; do not hand back a lecture.

## 1. Indexability — nothing else matters if this is broken

- `src/app/robots.ts` — allows crawlers, points at the sitemap, no accidental
  `disallow: /`.
- `src/app/sitemap.ts` — **every public route is listed.** This is the one that
  rots: adding a route without a sitemap entry is the most common miss in this
  starter. Cross-check `find src/app -name 'page.tsx'` against the sitemap array.
- Canonical URL on each page; no duplicate content across trailing-slash or
  parameter variants.
- `NEXT_PUBLIC_SITE_URL` set in the deployed environment, so `metadataBase`
  resolves OG/canonical to absolute URLs. Unset means social scrapers see
  `localhost`.
- No route accidentally opted out of static rendering. Any `headers()` /
  `cookies()` read — including `isBot()` — forces dynamic rendering and costs
  TTFB on every visit.

## 2. Metadata

Every route exports `metadata` via `generateMetadata` in
`src/utils/seo/generate-page-metadata.ts` (`obsidian/frontend/seo-metadata.md`).

- Unique, specific `title` per route — not the site name repeated.
- `description` per route, written for a human, 140–160 chars.
- OG image present and correctly sized (1200×630 is the target; the shipped
  `open-graph.png` is 900×600 — flag it).
- `themeColor` via `generateViewport`, not on the metadata object.
- `lang` on `<html>`; favicons and manifest present.

## 3. Content structure

- Exactly one `<h1>`, matching what the page is actually about.
- Heading outline is a real hierarchy with no skipped levels.
- `<main>` present; landmarks named; lists are lists.
- Answer-shaped content: the page states its answer near the top rather than
  building to it — this serves both featured snippets and AI extraction.
- Internal links use `<Link>`, have descriptive anchor text (never "click here"),
  and no important page is orphaned.
- Every image has meaningful `alt`.

## 4. Structured data

Run the `schema-markup` skill. At minimum `Organization` + `WebSite` from
`src/utils/seo/structured-data.ts`; add per-page types where they apply.
Validate the JSON-LD parses and references real on-page content.

## 5. Performance (Core Web Vitals)

Core Web Vitals are a ranking factor, so they belong in an SEO audit — but this
skill does **not** own them. Hand the measuring and fixing to **`optimize-load`**,
which audits all four categories across laptop, tablet and mobile on medians of
3+ runs, and report its numbers here. Do not run a single Lighthouse pass and
quote it: LCP and CLS swing wildly between identical runs.

What to check specifically from the SEO side:

- The numbers came from the **built** site (`yarn build && yarn start`) or the
  deployed URL — never `next dev`.
- **Every internal link resolves.** A link to a route that does not exist is a
  crawl error as well as a console error; `optimize-load` catches it, and it is
  usually the cheapest fix on the board.
- If the project renders a three.js/WebGL scene, **stop and use the
  `optimize-3d-scene` skill** — it owns that order of fixes.
- Lighthouse never scrolls. If the page is animation-heavy, a good score still
  says nothing about how it feels to use — that is `optimize-performance`.

## 6. The animation-specific crawler risk

Content revealed by scroll animation must exist in the DOM regardless. This
starter's springs only touch opacity/transform, so crawlers see the text — keep
it that way. Do **not** gate content behind an in-view callback that mounts it,
and prefer the `ReducedMotion` path over `isBot()` branching, which costs static
rendering and edges toward cloaking.

## 7. Output

A ranked table — issue, severity, file, fix — then apply the fixes. Re-run
`.claude/scripts/verify.sh` and `yarn build` afterwards. Note anything that needs
the user (a live URL, Search Console access, a correctly sized OG asset).
