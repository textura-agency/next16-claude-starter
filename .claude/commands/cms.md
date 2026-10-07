---
description: Put a Payload admin on this site — every string editable, SEO per page, the site's look, analytics, an editor's guide
argument-hint: [phase? — core | skin | seo | analytics | guide | prove]
---

Build (or continue) this site's CMS admin. Phase asked for: **$ARGUMENTS**
(empty = the whole flow, in order).

The flow is `obsidian/workflows/cms-admin.md`. Each phase has an owner skill —
load it and follow it exactly:

| Phase | Skill | Done when |
|---|---|---|
| 0 Pre-flight + proposal | `payload-cms` §0 | Node ≥ 22 pinned, peers checked, Supabase ready (`supabase-db` if not), all copy in `src/data/mocks/`, **the user approved the sidebar** |
| 1 Install + split | `payload-cms` §1 | `scaffold.sh core admin`, `(site)` / `(payload)` root layouts, env, scripts |
| 2 Content model | `payload-cms` §2 + `references/content-model.md` | `TEXT_GLOBALS`, `SKIP`, `OPEN_LISTS`, `LABELS` filled; views read `getText()` |
| 3 SEO | `payload-cms` §3 + `references/seo-global.md` | every route's `<head>`, JSON-LD, sitemap, robots, `/llms.txt` from the SEO global |
| 4 Migrate | `payload-cms` §4 | types + migration committed, `/admin` first user |
| 5 Skin | `payload-admin` §Skin | the admin wears the site's tokens; tour screenshots look right |
| 6 Analytics *(ask first)* | `payload-analytics` | consent-gated beacon, view + card, privacy policy agrees |
| 7 Guide *(last)* | `payload-admin` §Guide | `/admin/guide` with a screenshot per sidebar entry (`yarn qa:shots`) |
| 8 Prove | `payload-cms` §8 | edit → site, blank → fallback, no DB → site up, upload → bucket, routes static, Lighthouse unchanged |

Rules that hold throughout: routes stay static (save → `revalidatePath`), pages
import only views (metadata comes through the view), migrations only (`push:
false`), the code's copy is always the fallback, no motion added to the admin.

Stop and ask before: choosing which lists the editor may resize, adding
analytics, pointing local dev at a production database, any destructive migration.

Finish with `yarn verify`, `yarn lint`, `yarn build`, and the vault pass
(`cms-payload.md`, `tech-stack.md`, `environment-variables.md`, `changelog.md`,
an ADR for any departure from the skill's decisions D1–D16).
