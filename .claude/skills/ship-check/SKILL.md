---
name: ship-check
description: Pre-launch gate for this starter — build, mechanical rule checks, SEO, metadata and brand-kit completeness, the robot form, measured load (Lighthouse people + robot) and scroll (PC + phone), real-phone behaviour, accessibility, env and secret hygiene, the deploy steps and a closing retro. Use when the user says "ready to ship", "deploy this", "launch checklist", "is this production ready", or before handing a site to a client.
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

- every public route is in `sitemap.ts`; every `href` resolves (no 404s from nav
  items or the banner's `/privacy-policy`)
- `robots.ts` allows crawling and no staging `noindex` survives
- `NEXT_PUBLIC_SITE_URL` set in the production environment — and on the deployed
  site the canonical names the real domain and `curl -sI <og:image>` returns 200
- **no `TODO:` placeholder in `src/lib/site.ts`** (a production build fails on
  them by design); the brand kit is the site's own — favicon set from its logo,
  a 1200×630 share image you looked at (`tools/qa/brand-kit.mjs`)
- unique title + description per route
- the robot form: `curl -A "Googlebot/2.1"` and `-A "GPTBot/1.0"` get
  `<meta name="x-robot-view">`, the same title/canonical/`<h1>`, no text under a
  `hidden` ancestor; the human `/` is still prerendered
  (`optimize-load/references/robot-path.md`)
- `Organization` + `WebSite` JSON-LD renders and validates
- if this replaces an existing site → the `site-migration` skill's redirect map is
  live and verified

## 4. It is fast

Measure, do not guess — against the **deployed URL** (localhost is a floor:
one site's mobile LCP was 4.8 s local, 31 s hosted). If a WebGL/three.js scene
exists → the `optimize-3d-scene` skill first.

```bash
node tools/qa/lighthouse.mjs  --url https://<deploy>/ --runs 3   # people, mobile + desktop
node tools/qa/lighthouse.mjs  --url https://<deploy>/ --as-bot   # the robot form (what PageSpeed sees)
node tools/qa/scroll-test.mjs --url https://<deploy>/ --first-scroll   # PC wheel + phone touch, cold + warm, + the unlock moment
node tools/qa/axe-sweep.mjs   --url https://<deploy>/            # contrast through the entrance
node tools/qa/check-motion.mjs --url https://<deploy>/           # reduced motion + robot don't hang
```

- **Performance ≥ 90 on mobile and desktop; Accessibility, Best Practices, SEO
  = 100** — people and robot (`optimize-load`). A gap is stated with its number
  and cause.
- **Scroll `ideal`** on PC and phone: no frame > 50 ms, ≤ 1 % dropped
  (`optimize-performance`). Lighthouse never scrolls.
- LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; `grep -l ZodError .next/static/chunks/*.js`
  prints nothing.

## 5. It works on a phone in a hand

Run the **`mobile-device-qa`** skill's close-out: iOS toolbar probe and
context-loss probe for any live scene, scene fps (no fixed phone caps), the menu
in light and dark scheme, overflow at 320–430, touch sliders, WebKit for
anything iOS-only. Then push a preview and have the client (or a teammate) open it on their
phone, naming what to try. State what could only be checked in emulation.

## 6. It is usable by everyone

- Keyboard-only pass through every interactive element; focus always visible
- `prefers-reduced-motion` honoured — content readable with motion off
- Contrast AA; alt text everywhere; landmarks named
- 44px touch targets; no horizontal scroll at 320px
- `tools/qa/resize-check.mjs` — live resizes and device-preset switches land
  where a fresh load does

## 7. Nothing leaks

```bash
grep -rniE "sb_secret|service_role|BEGIN (RSA|PRIVATE)" src/ .env.example
git log --oneline -20            # no secrets in history
```

- Every secret is server-only via `getServerEnv()`; nothing sensitive is `NEXT_PUBLIC_`
- `.env` is gitignored; `.env.example` documents every key with placeholder values
- Every production env var is actually set on the host — a missing one fails the
  zod parse at boot, which is the intended behaviour, so check before launch not after

## 8. Deploy

Vercel is the default target for this stack (`vercel` → `vercel --prod`, or a Git
integration). Confirm after deploying:

- production env vars set for the Production environment, not just Preview
- custom domain + HTTPS resolving, `www`/apex normalised one way
- if Payload is installed: `payload migrate` has run against the production
  database, and `push` is **false** in production
- a real page loads, a form submits, an image from storage renders

- a Git-connected deploy that stops updating production: check the commit
  author's email belongs to the Vercel team (a repo-local `user.email` outside
  the team blocked every deploy on three sites for months)

## 9. Hand over — and retro

Summarise: what was checked and passed, what failed and was fixed, what could not
be verified and why, plus the measured numbers (the grid, the scroll verdicts).
Update `obsidian/meta/changelog.md` with the launch.

Then a short retro, for the next project cut from this starter: a measured fix
worth reusing → `obsidian/knowledge/fix-catalog.md` (symptom, fix, before →
after, rule/observed); something that misled you → `obsidian/knowledge/pitfalls.md`;
a defect that came *from the starter itself* → note it there as a starter fix
candidate; a skill that was wrong or silent → edit it.
