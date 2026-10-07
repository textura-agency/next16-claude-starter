---
tags: [workflow, cms, stable]
updated: 2026-10-07
---

# The CMS admin flow

How a site built from this starter gets a Payload admin its owner actually
likes: **every word on the site editable, grouped the way the site reads, SEO
per page with a live link preview, the site's own look, light consented
analytics, and a guide with screenshots inside the admin.** Distilled from a
production site where each of those was a separate request; here they are one
pass. ADR: [[decisions-log]] ADR-0027. Architecture: [[cms-payload]].

Entry point: **`/cms [phase]`**.

```
 0 Pre-flight ──► 1 Install + split ──► 2 Content model ──► 3 SEO ──► 4 Migrate
   (approve the                        (derive fields      (per-page     (types,
    sidebar)                            from mocks)          global)      first user)
                                                                              │
 8 Prove ◄── 7 Guide (last) ◄── 6 Analytics (ask) ◄── 5 Skin ◄────────────────┘
```

| Phase | Skill | Kit | Output |
|---|---|---|---|
| 0 Pre-flight | `payload-cms` | — | Node ≥ 22, peers, Supabase, **all copy in `src/data/mocks/`**, sidebar approved |
| 1 Install + split | `payload-cms` | `core` `admin` | `(site)` + `(payload)` root layouts, `SiteDocument`, `global-not-found`, env, scripts |
| 2 Content model | `payload-cms` | — | `TEXT_GLOBALS`, `SKIP`, `OPEN_LISTS`, `LABELS`; views read `getText()` |
| 3 SEO | `payload-cms` | (core) | `<head>`, JSON-LD, sitemap, robots, `/llms.txt` from one global |
| 4 Migrate | `payload-cms` | — | `payload-types.ts`, `migrations/`, `importMap.js` committed |
| 5 Skin | `payload-admin` | (admin) | the site's tokens, marks, welcome card, row labels, Settings last |
| 6 Analytics | `payload-analytics` | `analytics` | consent-gated beacon, `/admin/analytics`, dashboard card |
| 7 Guide | `payload-admin` | `guide` | `/admin/guide`, one screenshot per entry (`yarn qa:shots`) |
| 8 Prove | `payload-cms` | — | edit/blank/no-DB/upload/static/Lighthouse checks |

Kits are copied by `bash .claude/skills/payload-cms/scaffold.sh <kit…>`
(never overwrites without `--force`); then fill every `TODO` / `PROJECT CONFIG`.

## The ideas that make it work

1. **Derive, don't author.** The admin's fields are generated from the content
   objects the views already render. Copy added in code becomes a field on the
   next deploy, defaulted to its text. → [[cms-payload]] §How it works
2. **Merge, don't replace.** `getText()` returns the code's object with the
   admin's strings laid over it — same type, so no view or component changes,
   and a blank field, a never-saved global or a dead database all fall back to
   the code's copy.
3. **The editor edits words and photos, never wiring.** Links, anchors, ids,
   scene data and layout stay in code; card counts are fixed unless a list is
   explicitly opened with a floor the layout can carry.
4. **The admin reads like the site.** Sidebar in scroll order, numbered; labels
   and notes in the screen's words; rows named by their copy; the site's colours
   and marks; a guide that shows each screen beside the entry that edits it.
5. **SEO is content.** Every value the `<head>`, JSON-LD and sitemap emit has a
   field, with the code as fallback and a preview of the link card.
6. **Nothing about the site gets worse.** Routes stay static (revalidate on save),
   no client code added to the site except a consent-gated beacon, Lighthouse
   unchanged.

## When the request is smaller

| Request | Do |
|---|---|
| "the admin looks bad / match the site" | `payload-admin` §Skin |
| "add docs / hints in the admin" | `payload-admin` §Guide |
| "make X editable too" | sweep (`payload-cms/references/content-model.md` §Sweeping), add to mocks, migrate |
| "let them change how many cards" | `OPEN_LISTS` with the component's real floor/ceiling — ask first |
| "SEO in the admin" | `payload-cms` §3 |
| "analytics in the admin" | `payload-analytics` |
| "bold/links in the policy" | legal kit — `references/legal-rich-text.md` |

## Related

[[cms-payload]] · [[database-supabase]] · [[seo-metadata]] · [[agent-harness]] · [[pitfalls]] §6
