---
name: seo-audit
description: Audit a page or the whole site for technical and on-page SEO — crawlability, metadata, heading outline, structured data, internal linking, Core Web Vitals, and the animation-specific crawlability risks this starter carries. Produces ranked findings and fixes them in code. Use when the user asks to "audit SEO", "check my SEO", "why isn't this ranking", "fix meta tags", or before a launch.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, WebFetch
---

# SEO audit

Audit the **code**, and the live URL when one exists. Lessons from ~50
production sites built from this starter are folded in; the defects it used to
seed (placeholders, localhost canonicals, a hidden page for non-JS crawlers,
missing privacy route) are fixed upstream — check they stayed fixed. Rank findings by impact and
fix them; do not hand back a lecture.

## 1. Indexability — nothing else matters if this is broken

- `src/app/robots.ts` — allows crawlers, points at the sitemap, no accidental
  `disallow: /`.
- `src/app/sitemap.ts` — **every public route is listed.** This is the one that
  rots: adding a route without a sitemap entry is the most common miss in this
  starter. Cross-check `find src/app -name 'page.tsx'` against the sitemap array.
- Canonical URL on each page; no duplicate content across trailing-slash or
  parameter variants.
- **The origin.** `siteConfig.url` = `NEXT_PUBLIC_SITE_URL` → the host's
  production domain (`VERCEL_PROJECT_PRODUCTION_URL`) → localhost; set
  `NEXT_PUBLIC_SITE_URL` for a custom domain. `origin-sync.ts` (first in
  `<body>`) rewrites canonical / og:url / og:image to `location.origin` **after
  hydration** for JS-running readers on any other host — never before (React 19
  matches head tags by URL and inserts a second copy; one site served two
  canonicals). Link-preview scrapers don't run JS, so the build-time origin
  decides their cards. **Check on the deployed site:** canonical is the real
  domain, and `curl -sI` of the `og:image` URL returns 200 — 11 of 12 live
  deploys once served `http://localhost:3000` as canonical, og:image and every
  sitemap `<loc>`.
- No route accidentally opted out of static rendering. Any `headers()` /
  `cookies()` read — including `await isBot()` in a page or layout — forces
  dynamic rendering for every visitor. The UA is read in `src/proxy.ts`. Check:
  `curl -sI <url>/ | grep -i 'cache-control\|x-vercel-cache'` → `PRERENDER`/`HIT`.
- **Crawlers see the whole page.** `curl -s -A "Googlebot/2.1" <url>/` and
  `-A "GPTBot/1.0"`: the robot form (`<meta name="x-robot-view">`), the `<h1>`
  and the body copy present and **not under a `hidden` ancestor**. The starter's
  old empty `app/loading.tsx` wrapped the streamed page in `<div hidden>` — on
  most sites built from it, non-JS crawlers got no visible `<h1>`; it is deleted
  — never re-add an empty one. Streamed Suspense segments can still hide text
  from a non-JS reader; the robot form should stream nothing.
  (`optimize-load/references/robot-path.md`.)
- `robots.ts` disallows `/robot-view` (the robot form's own path is a duplicate
  — it is served under `/`). Never `noindex` the robot page itself.

## 2. Metadata

Every route exports `metadata` via `generateMetadata` in
`src/utils/seo/generate-page-metadata.ts` (`obsidian/frontend/seo-metadata.md`).

**No placeholder survives.** `src/lib/site.ts` ships `TODO:` values that fail
a production build — every site built from the old starter shipped "New
Project" as its title, OG card and JSON-LD name, and Lighthouse still scored
SEO 100 because a title *existed*. Fill every field from the site itself:

- `name` — the brand **exactly as the logo writes it**. If the copy and the logo
  disagree, ask; don't pick silently (a reviewer caught a wrong brand in a title).
- `title` — the brand + what it is, ≤ 60 chars (`Acme — Industrial design
  studio`); sub-pages `%s · Acme`, unique and specific per route.
- `description` — 120–160 chars from the site's own copy (no invention).
- `author` / `creator` / `publisher` = the brand, never the agency or a
  placeholder. `twitterHandle` = the site's real handle or `undefined` (the tags
  are omitted) — never an invented one, it tags a stranger.
- `themeColor` / `backgroundColor` = the brand ground (via `generateViewport`);
  `keywords` 5–8 phrases from the copy; `openGraph.type/locale/siteName`;
  `twitter.card = summary_large_image`.
- **The brand kit.** A square SVG mark drawn from the site's own logo that reads
  at 16 px (the logomark, or a monogram in the display face — never the full
  wordmark), then `node tools/qa/brand-kit.mjs --url … --icon <mark.svg>`
  renders `icon.svg`, `favicon.ico`, the PNG sizes, apple/maskable icons and a
  **1200×630 share image captured from the running hero** (its wait must cover
  the loader and the entrance; dismiss the banner; hide a custom cursor). LOOK at
  the share image: hero composed, headline legible, no loader, no banner, no
  half-faded text. If the hero doesn't compose at 1200:630, build a designed
  card (`app/opengraph-image.tsx`: the brand large over the hero art) — it beat a
  plain capture twice. Look at the 32 px and 180 px icons too. `og:image` has an
  `alt` and its real size.
- `lang` on `<html>`; manifest (`app/manifest.ts`) names the brand.
- Check the rendered `<head>` of the build
  (`curl -s localhost:3000/ | grep -oE '<(meta|link)[^>]+>'`) **and** of the
  robot form (`-A Googlebot/2.1`) — they must carry the same metadata.

## 3. Content structure

- Exactly one `<h1>`, matching what the page is actually about.
- Heading outline is a real hierarchy with no skipped levels.
- `<main>` present; landmarks named; lists are lists.
- Answer-shaped content: the page states its answer near the top rather than
  building to it — this serves both featured snippets and AI extraction.
- Internal links use `<Link>`, have descriptive anchor text (never "click here"),
  and no important page is orphaned. **Every `href` resolves** — nav items for
  pages that were never built point at `#` or a section anchor, never a 404; the
  cookie banner's `/privacy-policy` exists (build the page, don't drop the
  link).
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
it that way. Do **not** gate content behind an in-view callback that mounts it.

Robots get the **robot form**: the same content at rest, chosen in the proxy
(static for everyone) — not an `isBot()` branch in a page. Keep the two lines:
same content (different content for crawlers is cloaking), static route. Every
new section's first-screen copy uses the robot twins so it is visible in the
served HTML; every loop reads `useMotionOff()` (a looping spring hangs the robot
form — Lighthouse `PAGE_HUNG`). Procedure and checks:
`optimize-load/references/robot-path.md`.

## 7. Output

A ranked table — issue, severity, file, fix — then apply the fixes. Re-run
`.claude/scripts/verify.sh` and `yarn build` afterwards, and
`node tools/qa/lighthouse.mjs --url …` and again with `--as-bot` — SEO/BP 100 on
people **and** robot. Note anything that needs
the user (a live URL, Search Console access, a correctly sized OG asset).
