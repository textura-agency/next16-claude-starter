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
- Before optimising anything: `obsidian/knowledge/fix-catalog.md` and
  `obsidian/knowledge/pitfalls.md` — fixes measured on many production sites,
  and the traps that misled the measurements. Try *rule* entries first.

**Commands, skills and agents** live in `.claude/` and are mapped in
`obsidian/workflows/agent-harness.md`. Common entry points: `/new-page`,
`/section`, `/qa`, `/ship`, `/cms`, `/db`, `/seo`, `/migrate-site`, `/perf`,
`/load`, `/mobile`. The testing tools are `tools/qa/*` (`yarn qa:*`) — see
`tools/qa/README.md` and `obsidian/workflows/testing-pipeline.md`.

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
11. **Verify before reporting done.** `yarn verify` (`.claude/scripts/verify.sh`,
    zero FAILs) + `yarn lint` + `yarn build` after any code change, and the `qa-verify` skill
    after any UI change. See `obsidian/workflows/qa-verification.md`.
12. **CMS & database are Payload + Supabase**, added per project — not shipped in
    the starter. Use the `payload-cms` / `supabase-db` skills; see
    `obsidian/backend/cms-payload.md`. Note `middleware.ts` does not exist in
    Next 16 — it is `proxy.ts`.
13. **Performance → measure, never guess.** Build, measure, attribute, fix one
    thing, re-measure. **Never report a performance win you did not measure.**
    Records come from `tools/qa/*` against a **production build** (`yarn build &&
    yarn start`, never `next dev`), PC and mobile, median of 3+ runs, confirmed
    on the real host. **The bar:** Performance ≥ 90 on PC and mobile;
    Accessibility, Best Practices and SEO **100** — for people and for the
    robot form; scroll **ideal** (no frame > 50 ms) on PC and phone, first and
    second visit. Run `yarn qa:setup` once per machine. Two skills, by what is slow:
    - **Load** — Lighthouse scores, Core Web Vitals, accessibility, SEO →
      **`optimize-load`** (`yarn qa:lh`, `yarn qa:axe`). See
      `obsidian/workflows/optimize-load.md`.
    - **After load** — scroll jank, micro-freezes, dropped frames →
      **`optimize-performance`** (`yarn qa:scroll`, `--first-scroll` after a
      loader). Check first whether the *first* scroll is worse than the second;
      Lighthouse never scrolls and cannot see this. See
      `obsidian/workflows/optimize-performance.md`.
14. **3D performance → use the skill.** If the request is about performance,
    jank, or shipping readiness **and** the project renders a three.js / WebGL
    scene (`three` in `package.json`, or a canvas with a render loop), invoke the
    **`optimize-3d-scene`** skill first and follow its order of fixes — don't
    improvise one. See `obsidian/workflows/optimize-3d-scene.md`.
15. **Routes stay static; crawlers get the robot form.** Never `headers()`,
    `cookies()` or `isBot()` in a page, view, layout, `lib/site` or the SEO
    helpers — `src/proxy.ts` routes bots (search and AI crawlers) to
    `/robot-view`. Don't add an `app/loading.tsx` without a real skeleton (an
    empty one hides the page from non-JS crawlers). The consent banner is
    server-rendered — it is often the phone's LCP. See
    `obsidian/frontend/robot-form.md`, `.claude/rules/seo-robot.md`.
16. **Loops and frames.** Every looping spring reads `useMotionOff()` (reduced
    motion and the robot form would otherwise freeze the page). Per-frame code
    scales by `dt` in seconds (`src/lib/scene/per-frame.ts`) — 120 Hz phones run
    per-frame steps twice as fast. **No fixed frame cap on phones** (it reads as
    choppy); desktop scenes may gate the draw at ~60 fps (`createDrawGate`).
    Never stop drawing a canvas that is on screen; recover lost WebGL contexts
    (`src/lib/scene/webgl-context.ts`). See `.claude/rules/scenes.md`.
17. **Phones are checked on phones.** Lab tools miss what a person sees on an
    iPhone: Safari's toolbar resizing the viewport, 120 Hz speed, lost GPU
    contexts, menus under the bottom bar, dark-mode overlays, touch sliders.
    Full-screen scene boxes use the large viewport (`<SceneViewport>`); menus
    use `h-dvh` + the safe area, their own colour token and a portal under
    `<body>`. Something wrong on a phone → **`mobile-device-qa`** (`/mobile`,
    `yarn qa:ios`, `qa:fps`, `qa:context`, `qa:webkit` — WebKit for iOS-only
    bugs). Before calling UI done, have it opened on a real phone; if that
    didn't happen, say so. See `obsidian/workflows/mobile-device-qa.md`.
18. **No placeholders at launch.** `src/lib/site.ts` ships `TODO:` values on
    purpose: every build warns and a Vercel **production** build fails until
    the name, description, URL and brand assets are filled (brand kit:
    `yarn qa:brand`). See `obsidian/frontend/seo-metadata.md`.

## After making changes

Update the vault: dependency changes → `tech-stack.md` + `changelog.md`;
a measured fix or a trap worth keeping → `obsidian/knowledge/` (evidence rules in
its README);
architectural choices → an ADR in `decisions-log.md`; new component/hook/util →
the relevant catalog note. The `vault-librarian` agent can do this pass for you.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
