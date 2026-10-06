---
tags: [frontend, seo, stable]
updated: 2026-10-06
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

## robots.txt, sitemap.xml, manifest

- `src/app/robots.ts` → `/robots.txt` — allows all, disallows `/robot-view`
  (the robot form's own path — it is served under `/`), points at the sitemap.
- `src/app/sitemap.ts` → `/sitemap.xml` — one entry per public route (`/`,
  `/privacy-policy`). Add one with every route.
- `src/app/manifest.ts` → `/manifest.webmanifest`.

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

`src/utils/seo/structured-data.ts` → `getSiteStructuredData()` builds an
`Organization` + `WebSite` graph from `siteConfig`, rendered once by the root
layout. Point `logo` at the brand's real mark once it exists.

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
