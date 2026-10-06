---
description: Run an SEO and AEO audit (people and the robot form), then apply the fixes
argument-hint: [url-or-path?]
---

Audit search and answer-engine visibility for: **$ARGUMENTS**

Delegate to the `seo-auditor` agent, or run the skills directly if the scope is
small: `seo-audit` → `schema-markup` → `aeo-visibility`.

Priority order: indexability (robots, sitemap coverage vs actual routes,
canonicals and the serving origin, `NEXT_PUBLIC_SITE_URL`, routes still static)
→ **the robot form** (`curl -A "Googlebot/2.1"` / `-A "GPTBot/1.0"`: the page at
rest, same title/canonical/`<h1>`, no text under a `hidden` ancestor) →
metadata completeness (no `TODO:` placeholder, the brand as its logo writes it,
a real 1200×630 share image and favicon set — `tools/qa/brand-kit.mjs`) →
every `href` resolves → content structure and heading outline → structured data
→ measured Core Web Vitals (`node tools/qa/lighthouse.mjs --url …`, and
`--as-bot` for the robot form) → AEO (llms.txt, crawler policy, entity consistency).

Ask before changing AI-crawler policy in `robots.ts` — "be cited by AI" and
"don't train on my content" are different goals with different bots. Never
serve crawlers different *content* — the robot form differs only in motion.

Deliver a ranked findings table, apply the code fixes, and state clearly what
needs the user (Search Console access, a live URL, the brand mark, the real
handle, a crawler-policy decision).
