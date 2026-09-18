---
name: ship-check
description: Pre-launch gate for this starter — build, mechanical rule checks, SEO and metadata completeness, performance budget, accessibility, env and secret hygiene, and the deploy steps. Use when the user says "ready to ship", "deploy this", "launch checklist", "is this production ready", or before handing a site to a client.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, WebFetch
---

# Ship check

Run in order. Anything unchecked is stated as unchecked in the summary — never
assume a pass.

## 1. It builds and it obeys the rules

```bash
yarn lint
yarn build                       # must pass, no warnings you cannot explain
.claude/scripts/verify.sh        # zero FAILs
```

## 2. It is correct

Run the `qa-verify` skill across the site — every route, every breakpoint.
Then click through the real thing: `yarn build && yarn start`, not just dev.

## 3. It can be found

Run the `seo-audit` skill. Non-negotiable before launch:

- every public route is in `sitemap.ts`
- `robots.ts` allows crawling and no staging `noindex` survives
- `NEXT_PUBLIC_SITE_URL` set in the production environment
- unique title + description per route; OG image resolves absolutely
- `Organization` + `WebSite` JSON-LD renders and validates
- if this replaces an existing site → the `site-migration` skill's redirect map is
  live and verified

## 4. It is fast

Measure, do not guess. Run the **`optimize-load`** skill against the deployed URL
— all four categories across laptop, tablet and mobile, median of 3+ runs. A
single Lighthouse run is an anecdote.

- Green is ≥ 90 on every category and every profile, or the gap is stated with
  its number and its cause
- LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms
- Hero image `priority`; every image sized; fonts via `next/font`
- Lighthouse never scrolls, so it cannot see scroll jank — if the page is
  animation-heavy, also run **`optimize-performance`** and check the first scroll
  against the second
- If a WebGL/three.js scene exists → the `optimize-3d-scene` skill first

## 5. It is usable by everyone

- Keyboard-only pass through every interactive element; focus always visible
- `prefers-reduced-motion` honoured — content readable with motion off
- Contrast AA; alt text everywhere; landmarks named
- 44px touch targets; no horizontal scroll at 320px

## 6. Nothing leaks

```bash
grep -rniE "sb_secret|service_role|BEGIN (RSA|PRIVATE)" src/ .env.example
git log --oneline -20            # no secrets in history
```

- Every secret is server-only via `getServerEnv()`; nothing sensitive is `NEXT_PUBLIC_`
- `.env` is gitignored; `.env.example` documents every key with placeholder values
- Every production env var is actually set on the host — a missing one fails the
  zod parse at boot, which is the intended behaviour, so check before launch not after

## 7. Deploy

Vercel is the default target for this stack (`vercel` → `vercel --prod`, or a Git
integration). Confirm after deploying:

- production env vars set for the Production environment, not just Preview
- custom domain + HTTPS resolving, `www`/apex normalised one way
- if Payload is installed: `payload migrate` has run against the production
  database, and `push` is **false** in production
- a real page loads, a form submits, an image from storage renders

## 8. Hand over

Summarise: what was checked and passed, what failed and was fixed, what could not
be verified and why, plus the measured performance numbers. Update
`obsidian/meta/changelog.md` with the launch.
