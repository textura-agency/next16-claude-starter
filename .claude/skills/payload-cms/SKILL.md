---
name: payload-cms
description: Put a Payload CMS admin on a site built from this starter — every visible string and content photo editable, derived from the site's own content objects with the code's copy as the fallback, a per-page SEO global that drives <head>/JSON-LD/sitemap/llms.txt, Supabase Postgres + Storage, migrations only, static routes revalidated on save. Ships copy-ready kits (core, admin skin, analytics, editor's guide, legal rich text) proven on a production site. Use when the user asks to "add a CMS / admin / Payload", "make the content editable", "let the client edit the text", "SEO in the admin", or wants marketing copy out of hardcoded props. For the admin's look and the editor's guide see `payload-admin`; for visitor analytics see `payload-analytics`.
---

# Payload CMS — the admin flow

This is the flow a production site went through to get an admin its owner
called "great": every word on the site editable, grouped the way the site
reads, SEO per page with a live link preview, light consented analytics, the
site's own look, and a guide with screenshots inside the admin. It is written
down as kits (`templates/`) and decisions (below) so the next site gets there in
one pass instead of twenty requests.

**Read first:** `obsidian/workflows/cms-admin.md` (the flow at a glance) and
`obsidian/backend/cms-payload.md` (the architecture). Verified against
**Payload 3.89 · Next 16.3 · Node 24** (2026-10).

## The decisions — and why

Every one of these was a request or a defect on the reference site. Don't undo
one without the reason in front of you.

| # | Decision | Why |
|---|---|---|
| D1 | **Payload inside the app** — `app/(payload)` + `app/(site)`, one build, one deploy | The owner asked for one project. Local API reads in process — no HTTP hop, works at build time. |
| D2 | **Fields are derived from the content objects** (`text-schema.ts` walks `src/data/mocks/*`), not hand-written | Every string becomes a field defaulted to today's copy; a new line in code is a new field next deploy. Hand-written schemas drift and miss copy. |
| D3 | **Reading is a merge**: `getText("hero")` returns the code's `HERO` with the admin's strings laid over it — **same type** | Views and components stay untouched. A deliberate exception to "use the generated type in the view" (rule `payload.md`). |
| D4 | **Blank / missing / DB down → the code's copy**, error logged | The site never goes blank because the CMS did. A fresh database renders the full site. |
| D5 | **Globals, not collections or blocks**, for a marketing page's sections | Each section exists once; its order is choreographed with motion/scene, so it is not the editor's to reorder. Collections only for things that are many (posts, cases). Blocks only when the editor genuinely composes pages. |
| D6 | **Wiring is skipped** (`SKIP`: `id`, `href`, anchors, textures, scene data…); card lists have **fixed rows** matched by a hidden `key` | The editor rewrites a card but cannot break the layout, cross-wire a card to another's image, or add a 7th card to a 6-slot ring. |
| D7 | **`OPEN_LISTS`** with a floor/ceiling for lists the layout can resize; an added row must fill every line + photo | The client asked to change counts; the floor is what keeps a carousel from showing empty glass. |
| D8 | **Photos are optional uploads beside their copy** ("Replace photo"): blank → photo in code; upload → its URL, alt, a 512 px `small` size for textures, crop dropped | Same fallback rule as text. Only content photos — decorative art and the scene stay in code. |
| D9 | **One SEO global, a tab per page** + Site defaults; parity with everything `<head>`, JSON-LD and `sitemap.xml` emit; a **link-preview card** per tab | "SEO for each page, the same as the site has it." Titles are absolute (`Brand \| …`, 50–60 chars) and written for search; the plugin's fields are placed by hand because routes are fixed. |
| D10 | **Share image seeded into Media** on `onInit` (idempotent, never throws) | The editor sees the real card in the admin and can replace it, instead of a hint about a file in the code. |
| D11 | **Routes stay static**; every global's `afterChange` → `revalidatePath("/", "layout")` | Hard rule #15 holds; saves still show at once. |
| D12 | **Migrations only, `push: false` everywhere**; `yarn migrate:direct` over the session pooler | The same steps on every machine and the host. `push` against a live DB is how schemas get rewritten. |
| D13 | **Storage plugin always registered** (`enabled` from env, `alwaysInsertFields`), files linked from the **public bucket URL** | The schema — and so the migrations — never depend on whether a laptop has S3 keys. `next/image` and WebGL loaders fetch from Supabase's CDN, not through `/api/media/file`. |
| D14 | **English admin**, labels in the editor's words, sidebar groups in reading order, row labels from the row's own copy | An admin that reads like the site is one an owner uses. |
| D15 | **Every legal section is one rich-text field** (bold, links, lists, h3; table/button as blocks) | Asked for after a block-per-paragraph model: an editor could not bold a word or link inside a sentence. Start with rich text. |
| D16 | `/admin` and `/api/` disallowed in `robots.ts`; `/llms.txt` from the SEO global; sitemap `lastmod` = the globals' `updatedAt` | SEO audit findings: a login screen in the crawl budget, request-time `lastmod` (ignored), no llms.txt. |

## The kits

`bash .claude/skills/payload-cms/scaffold.sh <kit…>` copies a kit into the
project (never overwrites without `--force`) and prints every file — that list
is your checklist. Then `grep -rn 'TODO\|PROJECT CONFIG' src/cms src/app` and
fill each one.

| Kit | Files | Skill |
|---|---|---|
| `core` | `payload.config.ts`, `(payload)/*` plumbing, `(site)/layout.tsx`, `global-not-found.tsx`, `layouts/site-document.tsx`, `cms/{text-schema,content,globals,seo,seo-pages,seed}.ts`, collections users/media, `admin/share-preview.tsx`, `llms.txt/route.ts`, `scripts/migrate-direct.mjs` | this one |
| `admin` | `(payload)/custom.css` (the skin), `admin/{graphics,welcome,row-label}.tsx` | `payload-admin` |
| `analytics` | `cms/analytics.ts`, `collections/page-views.ts`, `api/track/route.ts`, `analytics-beacon.tsx`, `admin/analytics-*.tsx`, `admin/format.ts` | `payload-analytics` |
| `guide` | `admin/guide-{content,body,view,nav}.tsx` (+ `yarn qa:shots`) | `payload-admin` |
| `legal` | `cms/legal*.ts`, `views/legal/legal-rich-text.tsx` — **adapt-kit** (`--force`) | `references/legal-rich-text.md` |

`core` + `admin` is the minimum (the `(payload)` layout imports the skin).
`payload.config.ts` marks each kit's lines — delete the ones not installed.

## Phase 0 — Pre-flight (stop if any fails)

1. **Node ≥ 22 (24 recommended), pinned in `.nvmrc`.** On Node 20.17 Payload's
   CLI (`generate:importmap`, `generate:types`, `migrate:*`) **exits 0 and does
   nothing** — no error, no file. `node -v` before every CLI call.
2. **Next vs Payload peers:** `npm view @payloadcms/next@<ver> peerDependencies`
   against `package.json`'s `next`. Pin all `@payloadcms/*` and `payload` to the
   **same exact version** (no caret).
3. **A Supabase project** with its connection strings — run `supabase-db` first if
   not. Details: `references/supabase-wiring.md`.
4. **All copy lives in typed objects in `src/data/mocks/`.** Derivation (D2) only
   sees what is there. Sweep `src/views` and `src/components` for literal copy
   (headings, buttons, form errors, cookie banner, menu, emails in `lib/`, 404,
   legal labels) and move it into mocks **before** installing — this is the step
   the reference site had to redo twice. aria-labels may stay in code.
5. **Propose the admin to the user before writing config**: the sidebar
   (`Home page` → numbered sections in scroll order, `Site` → header/footer/forms/
   emails/cookie banner/SEO, `Pages & documents` → 404 + legal, `Settings`),
   what stays in code, which lists are open and why, which kits. Get a yes.

## Phase 1 — Install and split

```bash
yarn add payload@<v> @payloadcms/next@<v> @payloadcms/db-postgres@<v> \
  @payloadcms/richtext-lexical@<v> @payloadcms/storage-s3@<v> \
  @payloadcms/plugin-seo@<v> @payloadcms/translations@<v> graphql sharp
bash .claude/skills/payload-cms/scaffold.sh core admin
```

- `package.json`: `"type": "module"`; scripts `payload`, `generate:types`,
  `generate:importmap`, `migrate`, `migrate:create`,
  `"migrate:direct": "node scripts/migrate-direct.mjs"`.
- `tsconfig.json` paths: `"@payload-config": ["./src/payload.config.ts"]`.
- `next.config.ts`: `export default withPayload(nextConfig)`,
  `experimental.globalNotFound: true`, and `images.remotePatterns` for
  `*.supabase.co` + `*.storage.supabase.co` at `/storage/v1/object/public/**`.
- `src/env.ts` + `.env.example` — `references/supabase-wiring.md` §Env (all
  optional strings, empty = unset, so a laptop without a DB still builds).
- **Split the app into two root layouts:** `git mv` `src/app/{page.tsx,
  error.tsx,not-found.tsx,privacy-policy,robot-view,…}` → `src/app/(site)/`;
  move the body of the old `app/layout.tsx` into `src/layouts/site-document.tsx`
  (the kit's copy is the starter's layout as shipped — merge, don't overwrite)
  and delete `app/layout.tsx`. `api/`, `robots.ts`, `sitemap.ts`, `manifest.ts`,
  `globals.css` stay at `app/`. Point `global-not-found.tsx` at the real 404 view.
- `verify.sh` already skips `src/payload-types.ts` and `src/app/(payload)/`.

## Phase 2 — The content model

In `text-schema.ts` and `globals.ts` (`references/content-model.md` has the
rules and the edge cases):

1. **`TEXT_GLOBALS`** — one entry per content object, slug / numbered label /
   group / `base` / a one-line `note` (what the screen is + any rule before
   Save). Group order = sidebar order.
2. **`SKIP`** — every wiring key the mocks use. Read each mock; anything a reader
   never sees as words.
3. **`OPEN_LISTS`** / **`FIXED_LISTS`** — with the reason in a comment, from the
   component's real constraints (a ring's angle, a marquee's fill, a headline's
   line count).
4. **`LABELS`** — every key whose humanised name an editor wouldn't understand.
5. **Views read through `content.ts`**: `const hero = await getText("hero")` in
   the view (Server Component), passed down exactly as the mock was. Nothing
   below the view changes. Shared chrome (header, footer, cookie banner) is read
   once in `SiteDocument` / the layout and passed as props.
6. Emails and other server copy: `getText("emails")` in the route; placeholders
   are **named** (`{name}`, `{company}`) and the editor's text is escaped.

## Phase 3 — SEO (part of core — never skip)

1. `seo-pages.ts`: one entry per route + the 404 — titles **50–60 chars,
   absolute, opening on the brand**; descriptions 100–150; written for search.
2. Every route's metadata comes **through its view** (hard rule #5 — `page.tsx`
   imports only `@/views`): the view exports
   `export const getHomeMetadata = () => getPageMetadata("home")` and the page
   does `export const generateMetadata = getHomeMetadata`. `(site)/layout.tsx`
   uses `getSiteMetadata()`; `SiteDocument` renders `getStructuredData()`.
3. `sitemap.ts` → `getSitemapPages()` (noindex pages dropped, `lastmod` from the
   content). `robots.ts` → disallow `/admin` and `/api/` (keep `/robot-view`).
4. `/llms.txt` from the kit. Details: `references/seo-global.md`.

## Phase 4 — Schema, migration, first user

```bash
node -v                                   # ≥ 22 — see Phase 0
yarn generate:importmap                   # silent no-op? → node node_modules/payload/bin.js generate:importmap --force
yarn generate:types
yarn migrate:direct create init           # bare migrate:create does not load .env.local
yarn migrate:direct                       # apply over the session pooler
yarn dev                                  # /admin → create the first user
```

Commit `src/payload-types.ts`, `src/migrations/*`, `importMap.js`. A rename the
drizzle prompt would ask about cannot be answered non-interactively — split it
into drop + add migrations, or hand-write it and patch the `.json` snapshot
(`references/supabase-wiring.md` §Migrations).

## Phase 5 — The admin's look → `payload-admin` skill (§Skin)
## Phase 6 — Analytics (only if wanted) → `payload-analytics` skill
## Phase 7 — The editor's guide → `payload-admin` skill (§Guide) — **last**, it documents the final admin

## Phase 8 — Prove it (each one, not "it built")

1. **Edit → site:** change a field in each group, Save, refresh the site — shown.
   Put it back.
2. **Blank → fallback:** clear a field — the code's copy shows, nothing breaks.
3. **No database:** unset `DATABASE_URL`, `yarn build && yarn start` — the full
   site renders from code, errors logged once per global.
4. **Photo:** upload into a "Replace photo" field — the file lands in the bucket,
   the site shows it via the public URL; delete it → the code's photo returns.
5. **Open list:** cut to the floor and add a row — the section still looks right
   at rest and in motion; a half-filled new row is refused with its missing lines.
6. **SEO:** view-source on each route — title, description, canonical, og:image
   (1200 × 630), JSON-LD; `sitemap.xml`, `robots.txt`, `/llms.txt`.
7. **Static:** the build output lists the site's routes as static (○), not ƒ.
8. `yarn verify` · `yarn lint` · `yarn build` · Lighthouse unchanged (`yarn qa:lh`)
   — the CMS must not cost the site a point.

## Phase 9 — Vault (same turn)

`cms-payload.md` (what this project's admin holds: groups, open lists, kits,
where data lives), `tech-stack.md` + `changelog.md` (deps), `environment-
variables.md`, an ADR for any departure from D1–D16.

## Traps (each cost time on the reference site)

- Payload CLI on Node 20.17 → silent no-op (Phase 0).
- `.env.local` overrides `.env` — a `DATABASE_URL` left in both takes `.env.local`'s.
- Password with `%`/`$` in the URL: `%` throws "URI malformed"; `$` is expanded
  by `@next/env` and silently shortens it. Percent-encode, or letters+digits.
- Supabase's Direct host is IPv6-only → `ENOTFOUND` on IPv4; use the session
  pooler (5432) for `DATABASE_URL_DIRECT`.
- `revalidatePath` throws outside a request (seed, script) — the kit catches it.
- A `"use client"` module's exports are client references — a server component
  can't call a helper exported from one (why `admin/format.ts` exists).
- Payload's rich-text types use `any` — `verify.sh` skips `payload-types.ts`.
- Payload's admin class names aren't a public API: after an upgrade, open
  `/admin` and re-check the skin.
- Saving locally writes the live DB when dev and prod share one Supabase project
  — say so to the user; test edits go in and come back out.
