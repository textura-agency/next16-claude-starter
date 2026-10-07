# The SEO global — everything `<head>` reads, editable, with a preview

Code: `templates/core/src/cms/{seo,seo-pages,seed,content}.ts.tmpl`,
`admin/share-preview.tsx.tmpl`, `app/llms.txt/route.ts.tmpl`.

## Shape

**Site → SEO**, tabs: **Site defaults**, then one per route (`SEO_PAGES`) + 404.

| Tab | Fields | Feeds |
|---|---|---|
| Site defaults | site name, default description, default share image (Media, seeded), author/publisher, locale, X handle, organisation logo, social profiles (`sameAs`) + link preview | `og:site_name`, fallbacks, `authors/creator/publisher`, `og:locale`, twitter tags, JSON-LD Organization + WebSite |
| A page | overview, title (50–60), description (100–150), share image, canonical (default = its path), noindex (+ drops from sitemap), Google snippet preview, **link preview** | that route's `generateMetadata`, `sitemap.xml`, `/llms.txt` |
| 404 | title, description, image, previews — no canonical/noindex (always noindex) | `global-not-found` + `(site)/not-found` |

`@payloadcms/plugin-seo` is registered with `collections: [], globals: []` —
only for its admin strings/components; its fields (`MetaTitleField` etc.) are
placed by hand because routes are fixed, not a `pages` collection.

## The chain for every value

page tab → Site defaults → `seo-pages.ts` / `siteConfig` (the code). Blank
anywhere is safe. `siteConfig.url` stays the only source of the origin.

## Starter helpers (already extended for this)

- `generateMetadata({ absoluteTitle, ogImageSize, noIndex, locale, … })` —
  `absoluteTitle: true` because the editor writes the whole `<title>` (what the
  plugin's length bar counts); without it the starter appends `· Brand`.
- `getSiteStructuredData({ name, legalName, description, logo, sameAs })`.

Both default to `siteConfig`, so non-CMS projects are unaffected.

## The link preview (`SharePreview`, a `ui` field)

Reads the form live (`useAllFormFields`), fetches each upload id once from
`/api/media/<id>`, shows image / site name / title / description / address with
fallbacks applied and a line saying which image is showing. `seo-pages.ts` is
plain data (no Payload import) precisely so this client component can import it.

## The seed (D10)

`onInit: seedShareImage` — if Site defaults has no image: find `open-graph.png`
in Media by filename, else upload it from `public/` (or the live site), set it.
Idempotent, never throws (no DB / pending migration / storage away → logged).
Runs on the first init after the migration.

## Wiring checklist

- [ ] `SEO_PAGES`: every route in `src/app/(site)` + 404, copy written for search.
- [ ] each view: `export const getHomeMetadata = () => getPageMetadata("home")`;
      each `page.tsx`: `export const generateMetadata = getHomeMetadata` (rule #5 — pages import only views)
- [ ] `(site)/layout.tsx`: `getSiteMetadata()`; `SiteDocument`: `getStructuredData()`
- [ ] `sitemap.ts`:
  ```ts
  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const pages = await getSitemapPages();
    return pages.map(({ path, url, lastModified }) => ({
      url: url ?? `${siteConfig.url}${path === "/" ? "" : path}`,
      ...(lastModified ? { lastModified } : {}),
    }));
  }
  ```
- [ ] `robots.ts`: `disallow: ["/robot-view", "/admin", "/api/"]`
- [ ] `/llms.txt` lists exactly the sitemap's pages
- [ ] a new route later = an `SEO_PAGES` entry + a migration
- [ ] Lighthouse SEO 100 on every route, people + robot form
