---
tags: [backend, todo]
updated: 2026-05-21
---

# Backend — Not Implemented

`next16-claude-starter` is currently a **frontend-only** Next.js starter. There is no backend,
database, API layer, or authentication.

## What does not exist yet

- API routes / route handlers
- Database & ORM
- Authentication
- Server Actions for mutations
- External service integrations

The original starter spec listed these as "add as needed" placeholders:
Authentication, Database/ORM, Payments, Internationalization, Data Fetching.

## When a backend is added

Document it here. Suggested notes to create:

- `api-endpoints.md` — route handlers / Server Actions
- `database-schema.md` — tables, relations, migrations
- `auth.md` — authentication flow & session handling
- `services/` — external integrations

Also:
1. Add the dependencies to [[tech-stack]].
2. Record the choice as an ADR in [[decisions-log]].
3. Update [[data-flow]] with the new server-data path.
4. Add a [[changelog]] entry.

> [!tip] Deployment target
> The repo is set up for **Vercel**. If a backend is added, prefer Vercel-native
> options (Fluid Compute functions, Marketplace databases like Neon Postgres,
> Clerk for auth). See the session's Vercel guidance.

## Related

[[system-overview]] · [[tech-stack]]
