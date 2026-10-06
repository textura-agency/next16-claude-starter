---
paths:
  - "src/app/**"
  - "src/proxy.ts"
  - "src/views/**"
  - "src/lib/site.ts"
  - "src/utils/seo/**"
  - "src/utils/bot-ua.ts"
  - "src/utils/is-bot.ts"
  - "src/components/common/robot-*.tsx"
  - "src/components/common/origin-sync.ts"
  - "src/components/common/Cookie/**"
description: SEO invariants — static routes, the robot form, the origin, metadata
---

# SEO & the robot form

Full notes: `obsidian/frontend/seo-metadata.md` · `obsidian/frontend/robot-form.md`

- **`/` stays static.** Never `await headers()` / `cookies()` / `isBot()` in a
  page, view or layout — it renders every request (`private, no-store`, no CDN).
  The proxy (`src/proxy.ts`) tells robots apart by UA (`src/utils/bot-ua.ts`,
  incl. AI crawlers) and rewrites them to `/robot-view`.
- **Robot form = same content, no motion.** `HomeView({ robot })` wraps in
  `<RobotProvider>` + `<RobotView/>`; first-screen (better: every) `Spring` /
  `Inview` / `Hover` / `TextEngine` import comes from `robot-spring` /
  `robot-inview` / `robot-hover` / `robot-text`. No intro, no cursor, a still
  for 3D. Different *copy* for robots is cloaking. Detect it with
  `isRobotView()` (the server's `<meta>`), never the URL.
- **No `app/loading.tsx` that returns `null`.** It streams the page into
  `<div hidden>` — non-JS crawlers read nothing. Only real skeletons.
- **Origin:** `siteConfig.url` = `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL`
  → localhost, read through `src/env.ts`. Never derive it from the request.
  `origin-sync.ts` fixes JS readers on other hosts. After a deploy, curl the
  live `og:image` URL — localhost or 404 is a broken share card.
- **Metadata:** every value in `src/lib/site.ts` set (no `TODO:` — a Vercel
  production build fails on one); OG image really 1200×630 with `alt`;
  `icon.svg` first; no `src/app/favicon.ico` (it outranks `icon.svg`);
  `twitterHandle` only if real. Page titles go through `generateMetadata({ title })`
  → `Title · Brand`.
- **Every linked route exists** (`<Link>` prefetches: a missing route is a
  console 404 on every page → Best Practices < 100). The consent banner links
  `/privacy-policy` — keep it, with counsel-reviewed copy.
- **The consent banner is server-rendered** (it is the phone's LCP element).
  Never put it back behind `dynamic({ ssr: false })` or an intro gate.
- `siteConfig` is server-only (it pulls `zod`); client components get brand
  strings as props.
