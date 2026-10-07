---
paths:
  - "src/payload.config.ts"
  - "src/cms/**"
  - "src/app/(payload)/**"
  - "src/app/(site)/**"
  - "src/layouts/site-document.tsx"
  - "src/payload-types.ts"
  - "src/migrations/**"
description: Payload CMS conventions in this Next.js app
---

# Payload CMS

Full note: `obsidian/backend/cms-payload.md` · Flow: `obsidian/workflows/cms-admin.md`
· Skills: `payload-cms` (core), `payload-admin` (look + guide), `payload-analytics`

- Payload runs **inside this app**: `app/(payload)` (admin + its API) beside
  `app/(site)`; two root layouts, so unmatched URLs render `app/global-not-found.tsx`
  in `layouts/site-document.tsx`.
- **The code's content object is the contract.** Copy lives in `src/data/mocks/`;
  `cms/text-schema.ts` derives the fields from it; views read
  `await getText("slug")`, which returns **the mock's own type** with the admin's
  strings laid over it. Never hand-write a field for copy a mock already has,
  never cast Payload data to an interface.
- **Blank, missing or DB down → the code's copy.** Never let a CMS read throw
  into a view; read through `src/cms/content.ts` only (Local API, never the REST
  API from server code).
- **Wiring stays in code** — add new wiring keys to `SKIP`; card lists keep fixed
  rows unless named in `OPEN_LISTS` with a reason.
- **Routes stay static**; every global's `afterChange` revalidates. Pages import
  only views — metadata comes through the view (`getXMetadata`).
- **Schema change** → `yarn generate:types` → `yarn migrate:direct create <name>`
  → `yarn migrate:direct`. `push: false` everywhere. Commit `payload-types.ts`,
  `migrations/`, `importMap.js` (generated — never hand-edit).
- **Node ≥ 22** for every Payload CLI call — on 20.17 it exits 0 and does nothing.
- New admin component → `yarn generate:importmap`.
- The admin skin (`(payload)/custom.css`) takes colours only from its Tier 1
  `--admin-*` block; no transitions or animation added.
- **Never point local development at the production database** without the
  owner's explicit choice, recorded in an ADR.
