---
tags: [architecture, config, stable]
updated: 2026-05-21
---

# Environment Variables

Rules for handling configuration and secrets.

## Rules

- Store all secrets in **`.env.local`** — never commit it (it is git-ignored).
- Document every required variable in **`.env.example`** (committed, no real values).
- Reference variables in code via `process.env.VARIABLE_NAME`.
- Prefix with **`NEXT_PUBLIC_`** only if the value is safe to expose to the browser.
  Unprefixed variables are server-only.

## Current state

The starter has **no environment variables** yet — it is frontend-only with no
backend, auth, or external services. See [[backend/README]].

When the first variable is introduced:
1. Add it to `.env.example` with a comment describing it.
2. Document it in a table here (name, scope, purpose).
3. Add a [[changelog]] entry.

## Related

[[tech-stack]] · [[seo-metadata]] · [[backend/README]]
