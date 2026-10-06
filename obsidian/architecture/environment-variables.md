---
tags: [architecture, config, stable]
updated: 2026-10-06
---

# Environment Variables

Rules for handling configuration and secrets.

## Rules

- Store all secrets in **`.env.local`** — never commit it (it is git-ignored).
- Document every required variable in **`.env.example`** (committed, no real values).
- Reference variables in code via `process.env.VARIABLE_NAME`.
- Prefix with **`NEXT_PUBLIC_`** only if the value is safe to expose to the browser.
  Unprefixed variables are server-only.

## Current variables

| Name | Scope | Purpose |
|------|-------|---------|
| `NEXT_PUBLIC_SITE_URL` | public | Site origin (no trailing slash). Drives canonical URLs, OG/Twitter tags, `robots.txt`, `sitemap.xml`, JSON-LD. Unset → `VERCEL_PROJECT_PRODUCTION_URL` → `http://localhost:3000`. **Set it for a custom domain.** See [[seo-metadata]] → Origin. |
| `VERCEL_PROJECT_PRODUCTION_URL` | server-only (Vercel system) | The project's production domain, no scheme, set by Vercel at build time — the origin fallback. Not set by hand; for a local check: `VERCEL_PROJECT_PRODUCTION_URL=x.vercel.app next build`. |
| `VERCEL_ENV` | server-only (Vercel system) | `production` / `preview` / `development`. A `production` build **fails** while `siteConfig` holds `TODO:` placeholders. |
| `CONTACT_ENDPOINT` | server-only | Optional upstream the `/api/contact` route forwards leads to (CRM / webhook). When unset, submissions are logged server-side. See [[api-architecture]]. |

Documented in `.env.example` (committed). Validated by `src/env.ts` (zod):
`publicEnv` for `NEXT_PUBLIC_*` (safe anywhere), `getServerEnv()` for
server-only secrets (route handlers only) — see [[api-architecture]]. Read env
through `src/env.ts`, never `process.env` directly.

> [!important] Optional variables must treat `""` as unset
> `cp .env.example .env` — the documented setup step — leaves declared-but-blank
> keys (`CONTACT_ENDPOINT=`), which arrive as `""`, **not** `undefined`. A bare
> `z.url().optional()` rejects `""` as *"Invalid URL"*, so the copy alone broke
> `/api/contact`. Every optional variable therefore goes through the
> `optionalUrl()` helper in `src/env.ts`, which preprocesses `""` → `undefined`.
> **Follow this for any new optional variable** — `.optional()` on its own is not
> enough. (`optionalString()` does the same for non-URL strings.) This bites at
> build time too: `site.ts` parses the server env at import, so a blank
> optional var that fails validation **fails the build**.

> [!important] Secret handling
> Secret keys are **unprefixed** — `NEXT_PUBLIC_` is only for values safe in the
> browser. Secrets are read in server code (`app/api/**`); the browser never
> holds one. See [[api-architecture]].

When the next variable is introduced:
1. Add it to `.env.example` with a comment describing it.
2. Add a row to the table above (name, scope, purpose).
3. If it is optional, wrap it so `""` parses as unset (see the note above) —
   otherwise copying `.env.example` breaks it.
4. Add a [[changelog]] entry.

## Related

[[tech-stack]] · [[seo-metadata]] · [[backend/README]]
