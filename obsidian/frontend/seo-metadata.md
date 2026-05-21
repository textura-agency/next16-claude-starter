---
tags: [frontend, seo, stable]
updated: 2026-05-21
---

# SEO & Metadata

## Metadata generator

All pages produce metadata through a shared generator:
`src/utils/seo/generate-page-metadata.ts`.

```ts
import { generateMetadata } from "@/utils/seo/generate-page-metadata";

export const metadata = generateMetadata({
  title: "Page Title",
  description: "Page description",
});
```

It builds a Next.js `Metadata` object covering: basic meta tags, OpenGraph,
Twitter cards, canonical URL / alternates, and author/publisher info.

Accepted options: `title`, `description`, `keywords`, `url`, `ogImage`,
`twitterHandle`, `author`, `themeColor`, `siteName`.

The root layout (`app/layout.tsx`) already uses it — currently with placeholder
`"New Project"` title/description. **Update these per project.** `#todo`

## Bot detection

`src/utils/is-bot.ts` exports `isBot()` — a **server-only** async helper. It reads
the `user-agent` header and returns `true` for Lighthouse, Googlebot, PageSpeed,
HeadlessChrome, GTmetrix, Pingdom, Bingbot, Yandexbot.

Use it in Server Components to **skip heavy animations for crawlers** — improves
audit scores and indexability:

```ts
const bot = await isBot();
// pass `enabled={!bot}` down to animation components
```

## Static assets

`public/` holds favicons (multiple sizes), Android/Apple icons, `manifest.json`,
`browserconfig.xml`, and `open-graph.png` (default OG image).

## Related

[[routing]] · [[utils]] · [[animation-system]]
