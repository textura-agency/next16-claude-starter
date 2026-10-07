---
tags: [backend, cms, stable]
updated: 2026-10-07
---

# CMS — Payload

The content layer for projects built from this starter. **Not installed in the
starter itself** — added per project by the [[cms-admin]] flow (`/cms`), from
the kits in `.claude/skills/payload-cms/templates/`. ADRs: [[decisions-log]]
ADR-0020 (Payload + Supabase), ADR-0027 (the admin flow).

## Why Payload

It installs **into this Next.js app**: the admin is a route group, content is
read through an in-process Local API, and the schema generates TypeScript types.
One build, one Vercel project. Content lives in **Supabase Postgres**
([[database-supabase]]); uploads go to Supabase Storage over its S3 API.

## Shape (after the flow)

```
src/
├── payload.config.ts          # users, media, globals, Postgres, S3, English admin, custom views
├── payload-types.ts           # GENERATED — never hand-edit, always commit
├── migrations/                # GENERATED — committed; push is off everywhere
├── layouts/site-document.tsx  # the site's <html>, shared by (site)/layout and global-not-found
├── cms/
│   ├── text-schema.ts         # content object → Payload fields, and mergeText back
│   ├── globals.ts             # one global per section / chrome piece / document
│   ├── content.ts             # getText · getPageMetadata · getSiteMetadata · getStructuredData · getSitemapPages
│   ├── seo.ts · seo-pages.ts  # the SEO global (a tab per page) and its starting copy
│   ├── seed.ts                # onInit: the share card into Media, once
│   ├── analytics.ts           # recordView / recordDuration / readStats   [analytics kit]
│   ├── collections/           # users, media, page-views
│   └── admin/                 # marks, welcome, row labels, share preview, analytics, guide
└── app/
    ├── (payload)/             # admin + REST/GraphQL — generated plumbing + custom.css (the skin)
    ├── (site)/                # the site: layout, pages, error, not-found
    ├── global-not-found.tsx   # unmatched URLs (two root layouts → needs this)
    ├── api/track/             # the analytics beacon's endpoint            [analytics kit]
    └── llms.txt/              # from the SEO global
```

## How it works

- **Fields are derived, not hand-written.** `text-schema.ts` walks each content
  object in `src/data/mocks/` and makes a field for every string a reader sees
  (`text`/`textarea`), a group per object, an array per list; wiring keys
  (`SKIP`: `id`, `href`, anchors, textures, scene data…) are skipped; an image's
  `src` becomes an optional **Replace photo** upload. Rules and edge cases:
  `.claude/skills/payload-cms/references/content-model.md`.
- **Card lists have fixed rows** matched by a hidden `key` (the item's `id`) —
  rewritable, not addable — unless named in `OPEN_LISTS` with a floor and ceiling
  the component can carry; an added row must fill every line and a photo.
- **Reading is a merge.** `getText("hero")` returns the code's `HERO` with the
  admin's strings over it — **same type** — so views pass it down unchanged.
  Blank, missing, unknown or unreachable → the code's copy, error logged.
- **Globals, not collections or blocks**, for a marketing page: each section
  exists once and its order is choreographed with motion. Collections for things
  that are many (posts); blocks only when editors compose pages.
- **Saves show at once; routes stay static.** Every global's `afterChange`
  calls `revalidatePath("/", "layout")`.
- **Content enters at the view.** Routes import only views (hard rule #5) — a
  page's metadata too: the view exports `getXMetadata()`.

## SEO — a tab per page

**Site → SEO**: Site defaults (site name, description, share image — seeded from
`public/open-graph.png`, author, locale, X handle, logo, social profiles) and
one tab per route (title 50–60 absolute, description 100–150, share image,
canonical, noindex, Google snippet preview, **link preview card**). Feeds
`generateMetadata` (now with `absoluteTitle`, `ogImageSize`, `noIndex`,
`locale`), `getSiteStructuredData({…})`, `sitemap.xml` (noindex pages dropped,
`lastmod` from the content) and `/llms.txt`. `robots.ts` disallows `/admin` and
`/api/`. Details: `.claude/skills/payload-cms/references/seo-global.md`, [[seo-metadata]].

## The admin's look

Light only, the site's palette (one Tier 1 `--admin-*` block in
`(payload)/custom.css`; Payload's ramps mixed from it), the site's font, pill
buttons and tabs, calm labels, nothing merging, hover = colour only, **no added
motion**. Wordmark on login, favicon in the nav, a welcome card, rows named by
their copy, Settings last. Skill: `payload-admin`.

## Analytics (optional kit)

Consent-gated, cookieless, self-hosted: `/api/track` writes `page-views`
(visitor = one-day salted hash; IP/UA never stored; bots, DNT, GPC dropped;
visible time on page; edge country; retention = the privacy policy's). Read in
`/admin/analytics` and a 7-day dashboard card. Skill: `payload-analytics`.

## The editor's guide (optional kit)

`/admin/guide` — every sidebar entry with a screenshot of the screen it edits,
what each field changes and the rules, then SEO and Analytics explained.
Screens shot by `yarn qa:shots`. Skill: `payload-admin` §Guide.

## Rules

- **The code's content object is the contract** — a deliberate exception to "use
  the generated type in the view" (ADR-0027).
- **Read with the Local API** through `src/cms/content.ts`; never fetch your own
  REST endpoint from server code.
- **`push: false` everywhere**, committed migrations, applied with
  `yarn migrate:direct` (session pooler, 5432).
- **Node ≥ 22** for the Payload CLI (on 20.17 it silently does nothing).
- **Media requires `alt`.** Legal text is Lexical rich text, rendered with
  `RichText` + the site's converters — never `dangerouslySetInnerHTML`.
- **Never point local dev at the production database** without the owner's
  explicit choice, recorded in an ADR.

## Version constraint

Payload 3.89 peer-requires `next >=16.2.6 <17` (3.90 wants ≥ 16.3.3). The starter
runs 16.3.7. Pin every `@payloadcms/*` and `payload` to one exact version.
**Re-check before installing** — both sides move.

## Related

[[cms-admin]] · [[database-supabase]] · [[api-architecture]] · [[component-conventions]] · [[seo-metadata]] · [[tech-stack]] · [[backend/README]]
