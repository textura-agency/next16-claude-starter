---
tags: [meta, changelog]
updated: 2026-05-21
---

# Changelog

Chronological log of notable changes to the project. Newest first.
This is a human-curated log — not a mirror of `git log`.

## 2026-05-21

- **Animation engine — lint pass** — cleared all 13 pre-existing ESLint problems
  in the engine (2 errors + 11 warnings), an authorized engine edit (ADR-0009).
  `isMobileDisabled` now takes an optional `viewportWidth` argument, so the
  `active` memos in `<Spring>` / `<Hover>` / `<Inview>` / the trigger hooks
  depend on it genuinely. Added missing `disableOnMobile` effect deps; fixed a
  `trigger.current`-in-cleanup hazard in `<Hover>`; ref-stabilised `<Handle>`'s
  transition effects. **API change:** `useProgressTrigger` now returns `progress`
  as a `RefObject<number>` (read `.current`) instead of a render-time ref read —
  no consumer was affected (`<ProgressTrigger>` discards the return).
- **Animation engine — performance refactor** — fixed load issues that scaled
  with the number of animated components. Added `src/lib/animation/ticker.ts`, a
  single reference-counted `requestAnimationFrame` loop; `useLoop` (and all loop
  hooks) now subscribe to it instead of each starting its own rAF. `useWindowWidth`
  / `Height` / `Size` now share one debounced `resize` listener via a
  `useSyncExternalStore` store (the `debounceDelay` param was dropped — unused).
  `useDynamicInView` rewritten without the per-render `Proxy`/observer churn.
  Fixed a stale-closure bug in `useLoop`. `mode="forward"` scroll listeners made
  `passive`. This was an **authorized edit to `#do-not-modify` engine files** —
  hard rule #2 amended. See [[decisions-log]] ADR-0009 and [[animation-system]].
- **`spring-text-engine` updated** — bumped `^0.1.3` → `^0.1.5` (latest). The
  public API, types, and dependencies are unchanged between these versions
  (verified) — an internal-only patch bump, no code changes required.
- **Adaptive scaling grid added** — a root-font-size scaling system landed in
  `src/components/common/grid/` (`<AdaptiveGrid>` + `useAdaptiveGrid` hook +
  `grid.config.ts`), with `vw` media queries in `globals.css` for scale-down.
  It was dropped into `common/` as a `styled-components` system; ported to the
  project stack — config-driven TS + CSS-only Tailwind, no `styled-components`.
  The unused dropped files (`colors.ts`, `fonts.ts`, `utils.ts`, `index.ts`,
  the `styled-components` `grid.tsx`) were removed. Mounted via `<AdaptiveGrid>`
  in the root layout. See [[components/common]] and [[decisions-log]] ADR-0008.
- **Vault created** — `obsidian/` Obsidian vault initialised as the project's
  second brain. Architecture, frontend, and workflow docs populated. See [[decisions-log]] ADR-0001.
- **Root README rewritten** — replaced `create-next-app` boilerplate with a real
  project README that points into this vault.
- **`generic-layout-prompt.md` moved** — relocated from repo root to
  `obsidian/workflows/` as [[generic-layout-prompt]].
- **Navigation convention resolved** — standard `next/link` confirmed; the unbuilt
  `<AnimLink>` / `useAnimRouter()` convention dropped. See [[decisions-log]] ADR-0005.
- **Docs consolidated into the vault** — `project-specs.md` deleted (decomposed into
  vault notes + new [[environment-variables]]); `text-engine-docs.md` moved in as
  [[text-engine-reference]]. `AGENTS.md` rewritten as a thin shim; `.cursorrules`
  repointed to `@AGENTS.md`. The vault is now the single source of truth.
  See [[decisions-log]] ADR-0006.
- **Vault renamed & restructured** — vault folder `getlayers.io/` → `obsidian/`;
  number prefixes dropped from section folders (`00-meta` → `meta`, etc.). Project
  name standardised to **`next16-claude-starter`** across docs and `package.json`.
- **Components linked to docs** — every file in `src/components/` now carries a
  `// 📖 Docs:` pointer comment to its catalog note, so agents can jump from code
  to docs and back.
- **Vault workflow automated** — added `.claude/settings.json` with `SessionStart`,
  `UserPromptSubmit`, and `Stop` hooks that make agents read the vault first,
  follow the relevant guide, and update docs after every change — with no manual
  reminder. See [[decisions-log]] ADR-0007 and [[ai-agent-guide]].
- **Cookie component replaced** — the `react-cookie-consent`-based `cookie.tsx`
  was replaced by an in-house `Cookie/` component (banner + category preferences
  modal + Zustand store). `react-cookie-consent` removed from dependencies. The
  component shipped using `styled-components` + an external design system; it was
  ported to the project stack — Tailwind v4 tokens and `@react-spring/web` motion.
  Mounted via `<LazyCookie>`. See [[components/common]].
- **Fixed TextEngine spring type mismatch** — the `mode="once"` heading in
  `views/home.tsx` mixed `lineIn={{ y: 0 }}` (number) with `lineOut={{ y: "100%" }}`
  (string), throwing *"Cannot animate between _AnimatedString and _AnimatedValue"*.
  Changed to `y: "0%"`. The buggy pattern in [[text-engine]] / [[text-engine-reference]]
  examples was corrected and a type-matching gotcha note added.

## Project baseline (git history)

| Commit | Description |
|--------|-------------|
| `94b0870` | feat: update starter |
| `5280ef2` | fix: linter errors & build |
| `b2b84e6` | initial — `next16-claude-starter` scaffold |

> [!note]
> The starter shipped with: Next.js 16.2, React 19.2, Tailwind v4, `@react-spring/web`,
> `spring-text-engine`, Lenis, and Zustand. See [[tech-stack]] for the current state.
