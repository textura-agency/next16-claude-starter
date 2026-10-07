# Supabase wiring — env, connections, storage, migrations

## Env

`src/env.ts` → `serverSchema` (all `optionalString()` — empty means unset, so a
laptop without a database still builds and serves the code's copy):

```ts
/** Payload: signs admin sessions and salts the analytics' visitor hash. */
PAYLOAD_SECRET: optionalString(),
/** Supabase transaction pooler (6543) — the running app. */
DATABASE_URL: optionalString(),
/** Supabase session pooler (5432) — migrations only (`yarn migrate:direct`). */
DATABASE_URL_DIRECT: optionalString(),
/** Supabase Storage over S3 — all five, or uploads stay on local disk. */
S3_BUCKET: optionalString(),
S3_ENDPOINT: optionalString(),
S3_REGION: optionalString(),
S3_ACCESS_KEY_ID: optionalString(),
S3_SECRET_ACCESS_KEY: optionalString(),
```

…and the same keys in `getServerEnv()`'s `parse({…})`, and in `.env.example` with
a comment each. All server-only — never `NEXT_PUBLIC_`. **One env file** (`.env`)
is simplest; `.env.local` overrides `.env`, so a key in both takes `.env.local`'s.

## Where each value is in Supabase (2026 dashboard)

| Var | Where |
|---|---|
| `DATABASE_URL` | Connect → **Transaction pooler** (port **6543**) |
| `DATABASE_URL_DIRECT` | Connect → **Session pooler** (port **5432**, user `postgres.<ref>`). Not "Direct": that host is IPv6-only → `ENOTFOUND` on IPv4 networks |
| `S3_BUCKET` | Storage → New bucket (e.g. `media`), **public** |
| `S3_ENDPOINT` | `https://supabase.com/dashboard/project/<ref>/storage/s3` → `https://<ref>.storage.supabase.co/storage/v1/s3` |
| `S3_REGION` | Settings → General / Infrastructure (e.g. `eu-central-1`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | same S3 page → New access key |
| `PAYLOAD_SECRET` | `openssl rand -hex 32` — rotating it signs everyone out and resets analytics' day hashes |

Not needed: Connect → Framework (`@supabase/ssr`, `NEXT_PUBLIC_SUPABASE_*`) —
Payload talks to Postgres over the connection string.

**Percent-encode the password** in both URLs (`%`→`%25`, `$`→`%24`, `!`→`%21`,
`@`→`%40`, `#`→`%23`, `/`→`%2F`). A raw `%` makes `pg` throw "URI malformed"; a
raw `$` is expanded by `@next/env` as a variable and silently shortens the
password — no code can recover it. Easiest: a letters-and-digits DB password.

## One database or two

Default: **a separate Supabase project (or branch) for development.** If the
owner insists on one database for dev and prod (the reference site did), write
it in an ADR and tell them every local Save edits the live site.

## Storage (D13)

- `s3Storage({ enabled: Boolean(s3), alwaysInsertFields: true, … })` — always
  registered, so the schema never depends on env.
- `forcePathStyle: true` — Supabase does not serve virtual-host URLs; without it
  every upload 404s.
- `disablePayloadAccessControl: true` + `generateFileURL` → the **public bucket
  URL** (`…/storage/v1/object/public/<bucket>/<file>`). `next/image` and WebGL
  loaders (with `crossOrigin`) fetch from Supabase's CDN directly.
- `images.remotePatterns`: `*.supabase.co` and `*.storage.supabase.co`, pathname
  `/storage/v1/object/public/**`.
- Without all five `S3_*`, uploads go to `/media` on disk — fine locally, **lost
  on a serverless host**. Gitignore `/media`.

## Migrations

```bash
yarn migrate:direct create <name>   # writes src/migrations/<stamp>_<name>.{ts,json}
yarn migrate:direct                 # applies over DATABASE_URL_DIRECT
yarn migrate:direct status
```

`scripts/migrate-direct.mjs` loads the env files with `@next/env`, swaps
`DATABASE_URL_DIRECT` into `DATABASE_URL` for that process only and runs the
Payload CLI — bare `payload migrate:create` doesn't load `.env.local` and stops
at "missing secret key". It never prints either URL.

- **Renames:** drizzle asks "rename or create?" interactively and the CLI can't
  answer. Either split into two migrations (drop, then add — loses data, fine
  for a never-saved field) or hand-write the SQL and **patch the `.json`
  snapshot** to match, so the next `create` diffs from the truth.
- **Seeding rows into a saved global** (a list that gained a floor): do it in the
  migration's `up`, or the list opens empty under its floor.
- Before a destructive migration, count the rows it drops (`select count(*)`),
  and say in the ADR that nothing was carried over.
- Run `yarn migrate:direct` **before** the deploy that needs it; the host only
  needs `DATABASE_URL` + `PAYLOAD_SECRET` (+ `S3_*`).

## Email

No adapter by default: password-reset mail goes to the server log. If the site
already sends mail (Resend etc.), wire Payload's email adapter to it so editors
can reset their own passwords.
