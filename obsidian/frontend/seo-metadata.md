---
tags: [frontend, seo, stable]
updated: 2026-10-14
---

# SEO & Metadata

## Site config

`src/lib/site.ts` (`siteConfig`) is the **single source of truth** for SEO —
name, home title, description, keywords, origin URL, OG image + alt, Twitter
handle, author, theme/background colours, locale. The metadata generator,
`manifest.ts`, `robots.ts`, `sitemap.ts` and the JSON-LD helper all read it.

> [!important] Fill it in first — it fails loud
> Every value starting `TODO:` is a placeholder. In dev the tab title says
> `TODO: …`; every build prints `⚠ siteConfig has placeholder values: …`; a
> **Vercel production build throws** (`VERCEL_ENV=production`). The old quiet
> placeholders ("New Project", `@newproject`) shipped as live titles, OG cards
> and JSON-LD names, and Lighthouse still scored SEO 100 — a title *existed*.

| Field | What goes in |
|-------|--------------|
| `name` | the brand, as the logo writes it — also `applicationName`, `og:site_name`, the title template, the manifest |
| `title` | the home `<title>`: brand + what it is, ≤ 60 chars |
| `description` | 120–160 chars from the site's own copy (the hero's lead line) — never invented |
| `keywords` | 5–8 phrases from the copy (empty → no tag) |
| `ogImage` / `ogImageAlt` | a real 1200×630 image + what it shows |
| `twitterHandle` | the site's real handle, or `undefined` — the tags are then omitted. An invented handle tags a stranger |
| `author` | the brand (author / creator / publisher) |
| `themeColor` / `backgroundColor` | the brand's ground |
| `organization` | founding date, email, telephone, address, `sameAs` profiles — the JSON-LD `Organization` and `/llms.txt` "Key facts". Only what is true and stated elsewhere identically; leave a field out rather than guess |
| `aiCrawlers` | `{ search, userFetch, training }` — the client's policy per purpose (robots.txt below). Defaults all `true` |
| `verification` | Search Console / Bing codes, from the env (`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`) |

`siteConfig` is **server-only** — it reads the server env, which pulls in
`zod`. A client component importing it ships ~69 KB gz of zod (a banner's
privacy link was the usual leak). Pass brand strings to client leaves as props.
Check after a build: `grep -l ZodError .next/static/chunks/*.js` → nothing.

## Origin

`siteConfig.url` = `NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}`
→ `http://localhost:3000`, all read through `src/env.ts` at build time.

- Before the Vercel fallback, 50 of 53 production sites cut from this starter
  fell back to localhost, and 11 of 12 live deploys checked served
  `rel="canonical" href="http://localhost:3000"`, the same `og:url` /
  `og:image`, and localhost in every sitemap `<loc>` and robots.txt line.
- **Never derive the origin from the request** (`headers()` / `x-forwarded-host`):
  it makes every route dynamic — a site whose `/` went MISS → PRERENDER when
  that was removed.
- `src/components/common/origin-sync.ts` — an inline script in the root layout
  that, **after hydration**, rewrites canonical / `og:url` / `og:image` /
  `twitter:image` to `location.origin` when the page is served from another
  host (a preview, a local `next start`, a client's own domain), and removes the
  duplicate a client navigation re-inserts. Never before hydration — React
  matches head tags by URL and adds a second copy of any it can't find. Link
  previews (WhatsApp, Slack, X) don't run JS and still read the build-time
  value: **set `NEXT_PUBLIC_SITE_URL` for a custom domain.**
- After any deploy or meta change: fetch the live page, take its `og:image`,
  curl it — a localhost or 404 image is a broken share card.

## Metadata generator

`src/utils/seo/generate-page-metadata.ts`:

```ts
// root layout
export const metadata = generateMetadata();       // home title + `%s · Brand` template
// a page view
export const aboutMetadata = generateMetadata({
  title: "About",                                 // → "About · Brand"
  description: "…",
  url: "/about",
});
```

With a CMS ([[cms-payload]]) the page's `<head>` comes from the admin's SEO
global through `getPageMetadata()`, which passes `absoluteTitle: true` (the
editor writes the whole `<title>`), the upload's `ogImageSize`, `noIndex` and
`locale`. All four default to the starter's behaviour.

- `metadataBase` is always set from `siteConfig.url`, so relative URLs resolve
  to absolute — required by social scrapers.
- OG and Twitter images are declared **1200×630 with `alt`** — the file must
  really be that size (23 of 50 sites shipped the starter's 900×600, cropped or
  letterboxed by every scraper).
- `twitter:site` / `twitter:creator` only when a handle is set.
- Icons: `/icon.svg` first, then `/favicon.ico` (16/32/48), 32 and 16 px PNGs,
  the 180 px apple icon. There is **no `src/app/favicon.ico`** — Next links that
  file convention ahead of the `icons` list and it wins `/favicon.ico`.
- `generateViewport()` carries `themeColor` (Next deprecated it on metadata).

## Brand kit (placeholders shipped)

`public/icon.svg`, `favicon.ico`, `favicon-*.png`, `apple-icon-180x180.png`,
`android-icon-*.png` and `open-graph.png` are **placeholders** — a neutral ring
mark and a dashed "Replace public/open-graph.png" card. Per project:

1. **The mark** — a square SVG that reads at 16 px: the logomark, or a monogram
   in the brand's face (converted to paths) on the brand ground. Save it as
   `public/icon.svg`.
2. **Generate the set** from it at the listed sizes (the apple icon flattened
   on the ground — iOS ignores alpha); a 16/32/48 PNG-in-ICO `favicon.ico`.
3. **The share card**, 1200×630: a capture of the running hero (consent banner
   dismissed, no loader, entrance finished) where it composes, otherwise a
   designed card from the site's own parts — brand large, one line of copy.
   **Look at it**: a still caught mid-loader is the card every chat app shows.
   Update `ogImage` if the file name or format changes (`open-graph.jpg`).
4. `src/app/manifest.ts` builds `/manifest.webmanifest` from `siteConfig` (it
   used to be a static `manifest.json` named "App"); add `icon-512.png` and a
   maskable 512 icon when the real mark exists.
5. Check the rendered head: `curl -s localhost:3000/ | grep -oE '<(meta|link)[^>]+>'`
   — and the robot form carries the same.

## The route registry — `src/lib/routes.ts`

`ROUTES` lists every public page once: `path`, `label`, `summary`,
`indexable`, `updated` (the content's real date), `changeFrequency`,
`priority`, `parent`. Plain data with no imports, so a client nav may read it.
Everything that lists pages reads it:

| Output | From the registry |
|---|---|
| `/sitemap.xml` | every `indexable` route; `<lastmod>` only from `updated` |
| `/llms.txt` | every `indexable` route with its `summary` |
| breadcrumb JSON-LD | `routeTrail(path)` follows `parent` up to `/` |

`.claude/scripts/verify.sh` FAILs when an `app/**/page.tsx` has no entry
(route groups drop out of the path; `[slug]` routes list their pages from data
and are skipped). The old hand-kept sitemap array was the most common SEO miss
on sites built from this starter, and it stamped `lastModified: new Date()` on
every page every deploy — a date that always moves is a date Google ignores.

### Languages — `alternates` (opt-in)

A route with translations lists them: `alternates: { en: "/pricing", de:
"/de/preise" }` (each version includes itself). `routeLanguages(path)`
(`src/utils/seo/hreflang.ts`) turns that into the hreflang map with
`x-default` → `generateMetadata({ languages, alternateLocales })` → `<link
rel="alternate" hreflang>` + `og:locale:alternate`; `sitemap.ts` emits the same
as `<xhtml:link>`. An invalid code (`en_GB`, `en-UK`) or a set missing the page
itself **fails the build**. Single-language sites: no field, no output — the
sitemap and `<head>` are byte-identical. Full setup (`app/[lang]`, the proxy
per locale): skill `i18n-seo`.

CMS collections (blog posts, data-driven pages) aren't registry entries —
their hub is; the Payload kits append their pages to the sitemap and
`/llms.txt` ([[cms-payload]]).

## robots.txt, sitemap.xml, llms.txt, manifest

- `src/app/robots.ts` → `/robots.txt` — `*` allowed, `/robot-view` disallowed
  (the robot form's own path — it is served under `/`), the sitemap linked.
  Then **one named group per AI-crawler purpose**, allowed or disallowed by
  `siteConfig.aiCrawlers`:
  - `search` — `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`: index for
    AI answers and cite. Blocking them removes the site from those answers.
  - `userFetch` — `ChatGPT-User`, `Claude-User`, `Perplexity-User`: a person
    asked an assistant to open the page.
  - `training` — `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`,
    `Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`: a training
    opt-out; doesn't by itself remove citations, never touches Google Search.

  A named group replaces `*` for that crawler, so each repeats the disallow
  list. The policy is the client's decision — ask; the defaults allow all.
- `src/app/sitemap.ts` → `/sitemap.xml` — from the registry.
- `src/app/llms.txt/route.ts` → `/llms.txt` (llmstxt.org) — the brand, its
  description, the registry's pages with their summaries, and the
  `organization` facts. `force-static`: prerendered at build. The Payload kit
  swaps it for one that reads the SEO global.
- `src/app/manifest.ts` → `/manifest.webmanifest`.

## Search engine verification

`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` (the HTML-tag method's
`content` value) → `siteConfig.verification` → `<meta name="google-site-verification">`
/ `<meta name="msvalidate.01">` on every page through `generateMetadata`. Unset
→ no tag. Verify both at launch and submit `/sitemap.xml` in each — Bing's
index also feeds ChatGPT search and Copilot.

## Crawlers: the robot form, a static `/`, no hidden page

- **Robots are routed in the proxy** (`src/proxy.ts` → `/robot-view`), so every
  route stays prerendered. Full note: [[robot-form]].
- **No `app/loading.tsx` that returns `null`.** Its presence wraps the route
  in a Suspense boundary: the server streams the page into `<div hidden>` and
  an inline script reveals it — a crawler that doesn't run JS (GPTBot,
  ClaudeBot, PerplexityBot) reads a page whose content is hidden. Measured in
  production with a GPTBot UA: `<h1>` hidden → visible, hidden text 1,619 → 0
  characters after deleting it. The starter no longer ships one; add a loading
  state per route only with a real skeleton, and re-curl as a bot after.
- **Every linked route exists.** `<Link>` prefetches what it shows: a missing
  route is a console 404 on every page (Best Practices < 100) and a crawl
  error. The consent banner's `/privacy-policy` now ships (copy flagged
  `TODO(legal)` in `src/data/mocks/legal.ts`).

## The consent banner is the phone's LCP element

At 412 px the banner's paragraph is the largest text in the viewport. Mounted
client-only (`dynamic({ ssr: false })`), it painted after hydration and LCP
waited for the JS — on **every** site measured. It is server-rendered now (see
[[components/common]] → Cookie): mobile 53 → 74, LCP 11.0 → 2.3 s on the
cleanest A/B; 10+ sites, *rule*. Don't put it back behind a lazy import or an
intro gate.

## Structured data (JSON-LD)

`src/utils/seo/structured-data.ts` holds typed builders ([[utils]] lists them);
`<JsonLd>` ([[components/common|common]]) renders a document.

- **Site graph** — `getSiteStructuredData()`: `Organization` (or a
  `LocalBusiness` subtype via `type`) + `WebSite`, from `siteConfig` and
  `siteConfig.organization`, rendered once by the root layout. Point `logo` at
  the brand's real mark once it exists. Overrides (`name`, `legalName`,
  `description`, `logo`, `sameAs`, `type`) — the CMS passes the SEO global's
  Site defaults.
- **Page graph** — a view renders one `<JsonLd data={jsonLdGraph(…)} />`:
  the breadcrumb (`getBreadcrumbStructuredData(path)`, from the registry) plus
  `Article`, `Service` or `FAQPage` where the page really is one. Nodes point at
  the Organization by `@id` rather than repeating it. `/privacy-policy` ships
  the example.
- **Check Google's supported-features gallery before chasing a rich result.**
  FAQ rich results stopped in May 2026, HowTo in 2023, the sitelinks search box
  in 2024. `FAQPage` still describes a visible FAQ for answer engines — never
  questions the page doesn't show.
- **Local facts** — `siteConfig.organization` also holds `openingHours`,
  `geo`, `areaServed`, `priceRange`, `hasMap`. `areaServed` and `hasMap` go
  out whenever set; hours, geo and price range only when `type` is a
  `LocalBusiness` subtype (they aren't Organization properties). A business
  with several locations gives each its page and
  `getLocalBusinessStructuredData()` (own `@id`, `parentOrganization` → the
  brand). Every value exactly as the Business Profile writes it — skill
  `local-seo`.

## Bot detection

`src/utils/bot-ua.ts` holds the one UA list (search engines, AI crawlers, lab
tools); `src/proxy.ts` and `isBot()` both read it. `isBot()` reads
`headers()` and so makes its route dynamic — only in route handlers, never in a
page, view or layout (8 of 53 sites made `/` uncacheable that way).

## Static assets

The `public/` **root** holds meta/PWA/SEO assets — `icon.svg`, favicons,
Android/Apple icons, `open-graph.png`. Site **content** assets go under
`public/assets/<section>/` — see [[folder-structure]]. Code that warms an image
goes through `warmImage()` ([[utils]]), never the raw `/assets/…` path.

## Related

[[robot-form]] · [[routing]] · [[utils]] · [[animation-system]] · [[environment-variables]] · [[decisions-log]]
