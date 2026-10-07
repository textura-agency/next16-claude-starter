---
tags: [backend, stable]
updated: 2026-05-22
---

# Backend

`next16-claude-starter` is frontend-first, with a server **API layer**: Next.js
Route Handlers under `src/app/api/`. The starter itself ships **no database, CMS
or auth** — those are added per project, and the conventions for doing so are
documented here so every project built from this starter does it the same way.

## What exists

- **API endpoints** — `app/api/**/route.ts` Route Handlers. Convention and
  rules: [[api-architecture]].
- **Env validation** — `src/env.ts` (zod), public vs server-only split.
- **Shared API helpers** — `src/lib/api/` (`handle`, `ApiError`) and the
  client-side `src/lib/api-client.ts`.

## Not in the starter — added per project

| Need | Choice | Note | Added by |
|------|--------|------|----------|
| CMS | **Payload**, inside this Next app — built by the [[cms-admin]] flow | [[cms-payload]] | `/cms` |
| Database | **Supabase** Postgres | [[database-supabase]] | `/db` |
| File storage | **Supabase Storage** (S3-compatible) | [[cms-payload]] | `/cms` |
| Auth | **Supabase Auth** — only if real user accounts are needed | [[database-supabase]] | `supabase-auth` skill |

They stay out of the starter deliberately: most projects built from it are
marketing sites that never need a database, and an unused Payload install is a
large dependency surface plus a migration story to maintain. The decision is
recorded as ADR-0020.

Still open:

- Server Actions — the default for mutations is still TBD; everything currently
  goes through `app/api`.

Also: add deps to [[tech-stack]], record an ADR in [[decisions-log]], update
[[data-flow]], add a [[changelog]] entry.

> [!tip] Deployment target
> The repo targets **Vercel**. Route handlers run on Fluid Compute (Node.js) —
> do not use the Edge runtime (Next 16 removed it from `proxy.ts` regardless).
> See [[ship]] for the launch gate.

## Related

[[api-architecture]] · [[cms-payload]] · [[database-supabase]] · [[system-overview]] · [[tech-stack]] · [[environment-variables]] · [[ship]]
