---
name: i18n-seo
description: Multi-language sites that rank in every language — URL structure (subdirectories), Next 16 `app/[lang]` with static params and dictionaries, `<html lang>` per locale, the proxy (default language unprefixed, never redirect bots by language, the robot form per locale), hreflang (reciprocal, self-referencing, x-default, absolute) from the route registry, sitemap alternates, translated slugs and metadata, JSON-LD `inLanguage`, and Payload localization. Use when the user says "add a language", "translate the site", "multilingual", "i18n", "hreflang", "German/Spanish/… version", "localized", "wrong country version in Google", or a site serves more than one language or market.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, WebFetch
---

# Multi-language SEO

Google indexes each language version as its own page. hreflang only tells it
which version to show whom — it never merges or ranks them. So each version
needs its own URL, its own complete server-rendered HTML in that language, and
links between the versions that agree.

Read before touching code: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`
(Next 16: `app/[lang]`, `next/root-params`), and `src/proxy.ts` +
`obsidian/frontend/robot-form.md` (the robot form).

## 1. Decide the structure (ask the client)

| Structure | Example | Use when |
|---|---|---|
| **Subdirectories** (recommended) | `acme.com/de/…` | almost always — one domain's authority, one deploy, one Search Console property |
| ccTLDs | `acme.de` | separate businesses per country, local trust matters more than shared authority; a deploy/domain per market |
| Subdomains | `de.acme.com` | only when infrastructure forces it — authority splits like ccTLDs without their local signal |
| `?lang=de` / cookie / `Accept-Language` on one URL | — | **never** — one URL serves one language to Google |

Language or language + market? `de` serves every German reader; `de-AT` /
`de-CH` only when the content really differs (prices, legal, spelling).
Don't create region variants with identical text.

## 2. Routes — the language comes from the URL

Hard rule #15 still holds: routes stay static, nothing reads `headers()` /
`cookies()`. The language is a route segment.

```
src/app/[lang]/layout.tsx        ← the root layout: <html lang={lang}>
src/app/[lang]/page.tsx          ← imports only from src/views (rule #5)
src/app/[lang]/about/page.tsx
src/app/[lang]/robot-view/page.tsx
src/app/sitemap.ts, robots.ts, llms.txt/, api/   ← stay outside [lang]
```

(With Payload: `src/app/(site)/[lang]/…` beside `(payload)`.)

```tsx
// src/app/[lang]/layout.tsx
import { notFound } from "next/navigation";
import { LOCALES, hasLocale } from "@/lib/i18n";

export const generateStaticParams = () => LOCALES.map((lang) => ({ lang }));
export const dynamicParams = false; // an unknown language is a 404, not a render

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <html lang={lang}>{/* the starter's body, unchanged */}</html>;
}
```

- `src/lib/i18n.ts`: `LOCALES = ["en", "de"] as const`, `DEFAULT_LOCALE`,
  `hasLocale()`, plus the hreflang code and `og:locale` for each
  (`en` → `en_US`). Plain data — client-safe.
- **Dictionaries per locale** in `src/data/mocks/<locale>/…` (the same typed
  content objects the views already read, one set per language), loaded
  server-side by the view. Every string the page shows comes from them — a
  stray English string in the German page is a mixed-language page.
- Every page's `generateStaticParams` covers every locale (inherited from the
  layout's when the page has no other params). The build output must list
  each language's routes as static (○).
- **Translated slugs** are worth it (`/de/uber-uns`, not `/de/about`): map
  them in the route registry (§4) and in the nav, never by string-replacing
  paths.

## 3. The proxy

Decide where the default language lives:

- **Recommended — default language unprefixed** (`/about` English,
  `/de/about` German): the proxy **rewrites** an unprefixed path to
  `/<default>/…` internally and **redirects** a request for `/<default>/…` to
  the unprefixed URL (308), so each page has one address. No language guessing.
- All prefixed (`/en/…`, `/de/…`): then bare `/` is the x-default. Serve it as
  a language chooser page or the default language — or, if the client insists
  on redirecting people by `Accept-Language`, do it **only on bare `/`, only
  for people, 307**, and respect a saved choice.

**Never redirect a bot by language.** Googlebot crawls mostly from the US
without `Accept-Language`; a language redirect makes every other version
unreachable for it, and AI crawlers the same. The x-default URL must answer
200 to a bot. A "Deutsch?" suggestion banner (client-side, dismissible) is
safer than any redirect.

The robot form follows the language. Today the proxy rewrites a bot's `/` to
`/robot-view` and sends a person on `/robot-view` back to `/`, with
`matcher: ["/", "/robot-view"]`. With languages, the robot view lives under
each language and the matcher covers every page:

```ts
// src/proxy.ts — sketch; keep isBotUserAgent and the existing comments' rules
const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export function proxy(request: NextRequest) {
  const bot = isBotUserAgent(request.headers.get("user-agent"));
  const { pathname } = request.nextUrl;
  const [, first = ""] = pathname.split("/");
  const lang = (PREFIXED as readonly string[]).includes(first) ? first : DEFAULT_LOCALE;

  // /en/about → /about: the default language has one address.
  if (first === DEFAULT_LOCALE) {
    return NextResponse.redirect(new URL(pathname.slice(DEFAULT_LOCALE.length + 1) || "/", request.url), 308);
  }
  const rest = lang === DEFAULT_LOCALE ? pathname : pathname.slice(lang.length + 1) || "/";

  // A person on a robot-view address → the page itself.
  if (rest === "/robot-view" && !bot) {
    return NextResponse.redirect(new URL(lang === DEFAULT_LOCALE ? "/" : `/${lang}`, request.url));
  }
  // A robot on a language's home → that language's robot form. Never a language redirect.
  if (rest === "/" && bot) return NextResponse.rewrite(new URL(`/${lang}/robot-view`, request.url));
  // Unprefixed default-language paths render from /[lang]=DEFAULT.
  if (lang === DEFAULT_LOCALE) return NextResponse.rewrite(new URL(`/${DEFAULT_LOCALE}${pathname}`, request.url));
  return NextResponse.next();
}

export const config = {
  // Every page; not Next's assets, the API, the metadata files or public files.
  matcher: ["/((?!_next/|api/|sitemap.xml|robots.txt|llms.txt|manifest.webmanifest|.*\\.[\\w]+$).*)"],
};
```

`robots.ts` keeps disallowing every robot-view path (`/robot-view`,
`/de/robot-view`…) — `NEVER_CRAWLED` lists them. Prove the robot form per
language: `curl -s -A "Googlebot/2.1" <url>/de | grep x-robot-view`.

## 4. hreflang — from the route registry

`src/lib/routes.ts`: each version's entry carries the **same** `alternates`
map — every version, its own included:

```ts
{ path: "/about",       label: "About",    indexable: true, alternates: { en: "/about", de: "/de/uber-uns" } },
{ path: "/de/uber-uns", label: "Über uns", indexable: true, alternates: { en: "/about", de: "/de/uber-uns" }, parent: "/de" },
```

- `routeLanguages(path)` (`src/utils/seo/hreflang.ts`) returns the map with
  `x-default` added (→ the first version listed, unless named), validates the
  codes and that the page lists itself — an invalid code **fails the build**.
- In the view: `generateMetadata({ url: PATH, languages: routeLanguages(PATH),
  locale: "de_DE", alternateLocales: ["en_US"] })` → `<link rel="alternate"
  hreflang>` (absolute, via `metadataBase`) and `og:locale:alternate`.
- `sitemap.ts` already emits `<xhtml:link rel="alternate">` for every route
  with `alternates` — both places agree because both read the registry.
- Every language's page gets its own registry entry. `verify.sh` can't map
  `app/[lang]/…` files to paths (it skips dynamic segments), so the registry
  check falls to `yarn qa:seo`: an indexable page missing from the sitemap
  is a WARN there — treat it as a FAIL on a multi-language site.

The rules Google drops a cluster for:

1. **Reciprocal** — if A lists B, B lists A. Same map on every entry.
2. **Self-reference** — each page lists itself.
3. **Absolute URLs** on the real origin — never relative, never localhost.
4. **Valid codes** — ISO 639-1 language, optional ISO 3166-1 alpha-2 region:
   `en`, `en-GB`, `pt-BR`, `zh-Hant`. Wrong: `en_GB`, `en-UK` (→ `GB`),
   `jp` (→ `ja`), `ua` (→ `uk`), `es-419` (Google reads alpha-2 regions only).
5. **Each version is canonical to itself.** A German page canonical to the
   English one tells Google to drop the German page — hreflang can't save it.
6. Only **indexable, 200** pages in a cluster — no redirects, no noindex.
7. **`x-default`** for everyone else — the default language or a chooser.

## 5. Per-language metadata and content

- Title and description written in the language, for that market's searches
  — not machine-translated from the English titles. Search volumes differ:
  check the words people use there.
- `<html lang>` from the URL (§2); `og:locale` per page, the others as
  `og:locale:alternate`.
- JSON-LD: the page graph's `inLanguage` per locale (`getArticleStructuredData`
  and the WebSite node read `siteConfig.locale` — pass the page's language
  when adding locales); one Organization `@id` across languages (the same
  entity), its `name` unchanged.
- `/llms.txt`: one file at the root, a `## Pages` section per language
  (headed with the language's name), each listing that language's sitemap
  pages — `yarn qa:seo` compares it to the sitemap.
- **No unreviewed machine translation at scale.** Pages auto-translated and
  published without review fall under Google's scaled-content abuse policy —
  and read badly. Translate with review, or ship fewer languages.
- Keep the versions equal: a language with half the pages leaves hreflang
  pointing at pages that don't exist. Untranslated page → leave it out of
  that language's cluster (and nav), don't link to the English one under a
  German slug.
- A language switcher on every page links the *same page* in each language
  (from `alternates`), labelled in that language ("Deutsch"), as plain `<a>` —
  these links are also how crawlers find the versions.

## 6. Payload (when the CMS is in)

```ts
// payload.config.ts
localization: {
  locales: [{ label: "English", code: "en" }, { label: "Deutsch", code: "de" }],
  defaultLocale: "en",
  fallback: true, // a field blank in German shows the English — say so to the editor
},
```

- Mark the fields that differ per language `localized: true` — in the core
  kit's derived schema (`cms/text-schema.ts` → `fieldsOf`), make text fields
  localized; uploads usually stay shared. Collections: localize the copy
  fields and the `slug` (translated slugs), not dates or relations.
- Read with the locale: `payload.findGlobal({ slug, locale: lang, fallbackLocale: "en" })`;
  `getText(slug, lang)` / `readGlobal` take the language and include it in the
  `cache()` key. The code's fallback copy is per locale too (§5's dictionaries).
- The SEO global's page tabs become per-locale (localized title/description);
  the sitemap, `routeLanguages` and llms.txt read every locale.
- Turn localization on **before** content is entered: enabling it later moves
  every localized column into `_locales` tables — a migration that must carry
  the existing values to the default locale (check the generated SQL; never
  `push`).
- `afterChange` revalidation already drops the whole layout — every language.

## 7. Verify

- `yarn build` — every language's routes static (○); a bad hreflang code fails here.
- `yarn qa:seo --url http://localhost:4500/` — it crawls the hreflang
  targets too and FAILs non-reciprocal, invalid, relative or localhost
  hreflang and versions that don't answer 200; WARNs a missing self-reference,
  a missing x-default, `<html lang>` disagreeing with the page's hreflang, and
  a canonical pointing at another language. Robot-form parity includes the
  hreflang set.
- `curl -s -A "Googlebot/2.1" <url>/de` → 200, German, robot form — no redirect.
- After launch: Search Console has no international-targeting setting any
  more (retired) — hreflang is the signal. Watch Pages and Performance
  filtered by `/de/`; "Alternate page with proper canonical tag" for a
  language version means its canonical points elsewhere (§4 rule 5).

Vault: `obsidian/frontend/seo-metadata.md` (languages, the registry
alternates), `obsidian/frontend/robot-form.md` (the per-language proxy), an
ADR for the URL structure chosen.
