# The collection kit — many data-driven pages, each worth indexing

Code: `templates/collection/` (+ `templates/cms-shared/`, added with it).
`bash .claude/skills/payload-cms/scaffold.sh collection` after `core` + `admin`.
Verified end to end on 2026-10-14 (Payload 3.89 / Next 16.3.7, seeded
Postgres): a location page emits `ProfessionalService` with hours, geo and
`parentOrganization`; a thin page is `noindex` and out of the sitemap with its
reason in the admin; Lighthouse A11y / BP / SEO 100.

## When to use it

Many pages from one template where **the data differs per page**: locations,
services, integrations, use cases, industries, a directory, comparisons.
Not for pages that differ only by a swapped city or keyword — that is a
doorway page / scaled content, and Google demotes the whole set. The kit's
quality bar exists to make that hard to ship by accident.

## What it ships

| Route | Is | Search reads |
|---|---|---|
| `/entries` (rename) | the hub: every page, grouped | SEO global tab `entries`, `BreadcrumbList` |
| `/entries/<slug>` | one page | breadcrumb + `Service` / `LocalBusiness` by `kind` + `FAQPage` when it shows questions |

**Entries** (one collection; slug `entries` stays, the labels rename):
title (unique, `<h1>`), summary (= description, hub card, llms line), group
(hub section + "More in …" links), image, **facts** (label/value — the
per-page data), body (Lexical, h2–h3), questions, `kind`
(page / service / location), a **Place** tab for locations (business type,
address, phone, email, geo, hours, price range, map link) and a **Service**
tab (service type, areas served), *Search & sharing*, related (≤ 6), and a
read-only **Indexing** readout: "Shown in search", or "Hidden from search:
40 of 150 words in the body; 1 of 3 facts".

## The decisions — and why

| # | Decision | Why |
|---|---|---|
| C1 | **A quality bar decides indexing** — `minWords` (body, its own words) and `minFacts`; below it → `noindex`, out of the sitemap and `/llms.txt` | Scaled, templated pages are the fastest way to get a whole set demoted. Thin pages stay usable by people; only search waits |
| C2 | The summary doesn't count toward the bar | It is the sentence most likely to be templated |
| C3 | Facts are structured label/value rows, shown as a `<dl>` | The per-page data is what makes the page unique and what answer engines quote |
| C4 | `kind` picks the JSON-LD; a location's values come from its Business Profile | `LocalBusiness` per location (`parentOrganization` → the brand) — skill `local-seo` |
| C5 | Links built in: breadcrumb → hub, "More in <group>", related, back to hub; the hub links all | A set ranks as a set; no orphans, depth ≤ 2 from the hub |
| C6 | Questions in `<details>` + `FAQPage` only for what's shown | Answers stay in the HTML; FAQ rich results are gone (May 2026) — this is for answer engines |
| C7 | A map is a **link**, never an embedded iframe | An embedded Maps iframe costs the load score on every location page |
| C8 | Old slugs → 308; routes static; save → revalidate | Same as the blog kit (B3, B9) |

## Wiring checklist (after `scaffold.sh collection`)

- [ ] **Name the set:** `ENTRIES` in `cms/entries-config.ts` (`path`,
      `label`, `singular`, `defaultKind`, the bar) and `git mv
      src/app/(site)/entries src/app/(site)/<segment>`. Rename the views'
      folder too if you like — imports follow.
- [ ] `src/lib/routes.ts` — the hub (`path` = `ENTRIES.path`, `label` = `ENTRIES.label`).
- [ ] `src/cms/seo-pages.ts` — an `entries` tab (rename `name` and the
      view's `getPageMetadata("entries")` together).
- [ ] `src/data/mocks/entries.ts` — the hub's `<h1>` for the broad term.
- [ ] Link the hub from the header or footer.
- [ ] `sitemap.ts` + `/llms.txt` — `getEntriesSitemap()` and
      `getEntriesLlmsLines()` (same pattern as the blog,
      `references/blog.md`). Over ~45,000 pages, split with
      `generateSitemaps` (50,000 URLs per file); over a few hundred, list the
      hub and its groups in `/llms.txt`, not every page.
- [ ] Internal links from the rest of the site: the home page and the
      relevant service pages link the hub and the most important entries.
- [ ] `.prose-cms` typography (shared with the blog).
- [ ] `yarn generate:types` → migration → apply.
- [ ] Prove: one complete page and one thin one — the thin one shows its
      reason in the admin, renders `noindex`, is absent from `sitemap.xml`;
      a location's JSON-LD in the Rich Results Test; `yarn qa:seo` (no
      duplicate titles or descriptions across the set) and `yarn qa:lh`.

## Filling a set at scale (import)

Write rows through the Local API in a script (`payload run scripts/import.ts`),
`_status: "draft"` first. Review a sample per group, then publish. Every row
still needs its own body and facts — generating a body per row from a template
is the scaled-content pattern the bar exists to stop. If there's no unique
copy yet, import as drafts and let the Indexing readout be the to-do list.
