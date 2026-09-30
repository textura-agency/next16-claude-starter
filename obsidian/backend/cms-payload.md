---
tags: [backend, cms, wip]
updated: 2026-08-18
---

# CMS — Payload

The content layer for projects built from this starter. **Not installed in the
starter itself** — it is added per project by the `payload-cms` skill (`/cms`).
ADR: [[decisions-log]] ADR-0020.

## Why Payload

It installs **into this Next.js app** rather than running as a separate service:
the admin UI is a route group, content is read through an in-process Local API,
and the schema generates TypeScript types. That matches how this starter already
works — Server Components reading data and passing it down as props — and it keeps
the deployment a single Vercel project.

Content lives in **Supabase Postgres** ([[database-supabase]]); uploads go to
Supabase Storage over its S3-compatible API.

## Shape

```
src/
├── payload.config.ts        # collections, db adapter, storage, editor
├── payload-types.ts         # GENERATED — never hand-edit, always commit
├── collections/             # one file per collection
└── app/
    ├── (payload)/           # admin UI + Payload's REST/GraphQL routes
    └── …                    # the site — unchanged
```

## Rules

- **The generated type is the contract.** Field change → `generate:types` →
  `generate:migrations`. Never hand-write an interface for Payload data or cast to one.
- **Read with the Local API** (`getPayload({ config })`) in Server Components. It
  queries the database in-process — no HTTP hop, works during static generation.
  Never fetch your own REST endpoint from your own server code.
- **Content enters at the view.** `app/**/page.tsx` still only imports a view
  (hard rule #5); the view fetches and passes props down. Presentational components
  stay CMS-agnostic ([[component-conventions]]).
- **Blocks for page composition** — one block per section component, so an editor
  can reorder sections without a deploy. Keep block field names identical to the
  component's prop names so `<Hero {...block} />` type-checks.
- **Media requires `alt`** at the schema level — hard rule #10 is easier to keep
  when the CMS refuses to save an image without it.
- **Lexical rich text**, rendered with `@payloadcms/richtext-lexical/react`. Never
  `dangerouslySetInnerHTML`.
- **`push: false` in production**, with committed migrations. `push: true` against
  a live database is how schemas get rewritten and data is lost.
- **Never point local dev at the production database.**

## Version constraint — currently satisfied

`@payloadcms/next` 3.88 peer-requires `next >=16.2.6 <17`. The starter runs
`16.3.7` (as of 2026-09-30), so no bump is needed. **Re-check before installing** —
this is a moving target on both sides, and it was a genuine blocker until the
dependency refresh. Payload's own blank template tracks Next 16.3 / React 19.2.

## Related

[[database-supabase]] · [[api-architecture]] · [[component-conventions]] · [[tech-stack]] · [[backend/README]]
