# Agent Guide — next16-claude-starter

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. **Heed deprecation notices and verify against the
docs before writing routing or framework code.**

## Documentation lives in the vault

All project documentation is the **`obsidian/`** Obsidian vault — it is the
single source of truth for how this project is built.

**Before working, read:**
- `obsidian/README.md` — Map of Content (index of every doc)
- `obsidian/workflows/ai-agent-guide.md` — full rules of engagement
- The relevant topic note (e.g. `frontend/animation-system.md` before animation
  work, `workflows/new-page.md` before building a page)

**Commands, skills and agents** live in `.claude/` and are mapped in
`obsidian/workflows/agent-harness.md`. Common entry points: `/new-page`,
`/section`, `/qa`, `/ship`, `/cms`, `/db`, `/seo`, `/migrate-site`.

Notes link each other with `[[wikilinks]]` — follow them to navigate.

## Hard rules (never violate)

1. **All motion is spring-based** — `@react-spring/web` via the components in
   `src/components/animation/springs/`. Text animation uses `spring-text-engine`.
   No CSS keyframes, no `framer-motion`. **One exception:** CSS `transition-*` is
   allowed for simple discrete state changes (hover/focus colour, opacity,
   border, small nudges) with token-backed timing —
   `duration-[var(--duration-fast)] ease-entrance`. Everything scroll-driven,
   revealing, staggered, or layout-affecting stays a spring. See
   `obsidian/frontend/design-system.md`.
2. **Do not modify** `src/components/animation/springs/` or `src/hooks/animation/`
   without explicit sign-off — they are the vendored animation engine. One
   authorized performance refactor has been made (see `decisions-log.md`
   ADR-0009); they remain protected by default.
3. **Never `mode="manual"`** on `TextEngine` — use `always` / `once` / `forward` /
   `progress`. `TextEngine`'s container is **flex**, so `text-align` alone cannot
   align it — always pair `text-center` with `justify-center` (etc.) on the tag.
   And `overflow` clips to the line-height box, so keep leading ≥ 1.1
   (`leading-display`); never `leading-none` with `overflow`, or glyphs get
   shaved. See `obsidian/frontend/text-engine.md`.
4. **No hardcoded values** — design tokens in `globals.css` for styles; props/hooks
   for content. No raw hex/px in class names. Tokens follow a strict three-tier
   convention (`--raw-*` primitive → semantic role → `@theme` binding) that is
   identical across every project built from this starter — see
   `obsidian/frontend/design-system.md`.
5. **Routes delegate to views** — `app/**/page.tsx` imports only from `src/views/`.
6. **Server Components by default**; add `"use client"` only at the leaves.
7. **No `any`.** Type everything. Run `yarn lint` before finishing.
8. **Navigation** — standard `next/link` `<Link>` and `next/navigation` `useRouter`.
9. **API & secrets** — external/third-party calls run server-side in
   `app/api/**/route.ts`; secret keys are server-only env vars (never
   `NEXT_PUBLIC_`, read via `src/env.ts`). The browser only calls same-origin
   `/api/*`. Validate input with `zod`; return the `{ data }` / `{ error }`
   envelope. See `obsidian/backend/api-architecture.md`.
10. **Semantic, SEO-correct HTML** — native elements over `div`s, one `<h1>` +
    a clean heading outline, named landmarks, real `button`/`a`, `alt` text,
    JSON-LD (not microdata), semantic `tag` on animation components. See
    `obsidian/frontend/html-semantics.md`.
11. **Verify before reporting done.** `.claude/scripts/verify.sh` (zero FAILs) +
    `yarn lint` + `yarn build` after any code change, and the `qa-verify` skill
    after any UI change. See `obsidian/workflows/qa-verification.md`.
12. **CMS & database are Payload + Supabase**, added per project — not shipped in
    the starter. Use the `payload-cms` / `supabase-db` skills; see
    `obsidian/backend/cms-payload.md`. Note `middleware.ts` does not exist in
    Next 16 — it is `proxy.ts`.
13. **Performance → measure, never guess.** Build, measure, attribute, fix one
    thing, re-measure. **Never report a performance win you did not measure.**
    Two skills, by what is slow:
    - **Load** — Lighthouse scores, Core Web Vitals, accessibility, SEO, "get it
      in the green" → **`optimize-load`**. Always all four categories across
      laptop, tablet and mobile, median of 3+ runs; green is ≥ 90, not 100. See
      `obsidian/workflows/optimize-load.md`.
    - **After load** — scroll jank, micro-freezes, dropped frames →
      **`optimize-performance`**. Check first whether the *first* scroll is worse
      than the second; Lighthouse never scrolls and cannot see this. See
      `obsidian/workflows/optimize-performance.md`.
14. **3D performance → use the skill.** If the request is about performance,
    jank, or shipping readiness **and** the project renders a three.js / WebGL
    scene (`three` in `package.json`, or a canvas with a render loop), invoke the
    **`optimize-3d-scene`** skill first and follow its order of fixes — don't
    improvise one. See `obsidian/workflows/optimize-3d-scene.md`.

## After making changes

Update the vault: dependency changes → `tech-stack.md` + `changelog.md`;
architectural choices → an ADR in `decisions-log.md`; new component/hook/util →
the relevant catalog note. The `vault-librarian` agent can do this pass for you.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
