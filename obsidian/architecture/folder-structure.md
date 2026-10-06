---
tags: [architecture, stable]
updated: 2026-10-06
---

# Folder Structure

Where everything lives and what belongs where. The repo has two top-level concerns:
the **app** (`src/`) and this **vault** (`obsidian/`).

## Repo root

```
next16-claude-starter/
├── src/                     ← application code (see below)
├── public/                  ← static assets (see "public/" section below)
├── obsidian/                ← this Obsidian vault — ALL project documentation
├── .claude/                 ← agent execution layer — see [[agent-harness]]
│   ├── settings.json        ← hooks + permissions
│   ├── scripts/verify.sh    ← mechanical hard-rule checks
│   ├── rules/               ← path-scoped context (auto-loads per file read)
│   ├── skills/              ← procedures loaded on demand
│   ├── agents/              ← subagent definitions
│   └── commands/            ← slash commands
├── app config files         ← next.config.ts, tsconfig, eslint, postcss
├── .nvmrc                   ← pinned Node for local dev (see [[tech-stack]] → Runtime)
├── README.md                ← project README → points into the vault
├── AGENTS.md                ← agent guide — breaking-change warning, hard rules, vault pointer
├── CLAUDE.md                ← Claude Code entry → @AGENTS.md
└── .cursorrules             ← Cursor entry → @AGENTS.md
```

All documentation lives in the vault. The root `AGENTS.md` / `CLAUDE.md` /
`.cursorrules` are thin shims that carry the hard rules and point into it —
see [[ai-agent-guide]]. `.claude/` holds the execution layer: hooks and
permissions in `settings.json`, plus the commands, rules, skills, agents and the
`verify.sh` check script — see [[agent-harness]].

## `src/` — application code

```
src/
├── env.ts                  # zod-validated env (public + server-only split)
├── proxy.ts                # robots on "/" → /robot-view (UA via utils/bot-ua.ts)
│
├── app/                    # Next.js routes — keep lean, routing only
│   ├── layout.tsx          # Root layout — provider tree lives here
│   ├── page.tsx            # Route → delegates to a view
│   ├── api/<resource>/route.ts  # API endpoints — see [[api-architecture]]
│   ├── error.tsx           # Route-segment error boundary
│   ├── not-found.tsx       # 404 page
│   ├── robot-view/page.tsx # the robot form of "/" — see [[robot-form]]
│   ├── privacy-policy/     # boilerplate legal route (TODO(legal))
│   ├── robots.ts           # → /robots.txt
│   ├── sitemap.ts          # → /sitemap.xml
│   ├── manifest.ts         # → /manifest.webmanifest
│   └── globals.css         # Tailwind v4 config + design tokens
│                           # (no loading.tsx, no favicon.ico — see [[routing]], [[seo-metadata]])
│
├── views/                  # Page-level components — one per route
│   ├── home.tsx            # HomeView({ robot }) (Server Component, empty — start here)
│   └── legal/              # LegalDocument + PrivacyPolicyView
│
├── layouts/                # Reusable layout wrappers
│   └── scroll-layout.tsx   # Lenis smooth-scroll wrapper
│
├── components/
│   ├── ui/                 # Design-system primitives (Button, Input…) — empty, add as needed
│   ├── common/             # Shared infrastructure (Cookie, grid, ReducedMotion, Skeletons,
│   │                       #   robot-view + robot-*, origin-sync, scene-viewport)
│   └── animation/springs/  # ⚠️ Animation engine — #do-not-modify
│
├── hooks/                  # Custom hooks, grouped by domain
│   ├── animation/          # ⚠️ Animation hooks — #do-not-modify
│   ├── smooth-scroll/      # useScroll Zustand store
│   ├── use-motion-off.ts   # reduced motion OR robot form — every loop reads it
│   ├── use-scroll-lock.ts  # lock Lenis + native scroll (one-screen, menus)
│   └── use-window-size.ts
│
├── lib/                    # Third-party client init / global config
│   ├── animation/ticker.ts # Shared app-wide requestAnimationFrame loop
│   ├── api/                # API route-handler helpers (handle, ApiError)
│   ├── api-client.ts       # Typed same-origin /api fetch wrapper (client)
│   ├── scene/              # per-frame.ts · webgl-context.ts · device-tilt.ts — [[webgl-scenes]]
│   ├── site.ts             # Site-wide SEO config (single source of truth, server-only)
│   └── springs/config.ts   # Global animation config
│
├── utils/                  # Pure utility functions (no side effects)
│   ├── animation/coords.ts
│   ├── seo/generate-page-metadata.ts · seo/structured-data.ts
│   ├── bot-ua.ts · is-bot.ts · lvh.ts · math.ts · scroll-to.ts
│   ├── stable-viewport.ts · warm-image.ts
│
├── types/                  # Shared TypeScript types
│   ├── springs.ts
│   └── robot-view.d.ts     # window.__robotView
│
└── style/                  # Extra CSS layers imported into globals.css
    └── index.css
```

## `public/` — static assets

```
public/
├── icon.svg, favicon.ico, *-icon-*.png, open-graph.png (1200×630)
│                            # site-level meta / SEO assets — PLACEHOLDERS, replace per project
└── assets/                  # site content assets (images, video, …)
    └── <section>/           # one folder per section that uses them
```

> [!important] Asset convention
> Content assets used **on the site** (images, videos, …) live under
> `public/assets/`, and **each section gets its own folder** — e.g.
> `public/assets/hero/`, `public/assets/footer/`. Reference them by absolute
> path (`/assets/hero/bg.webp`) through `next/image` — code that fetches one
> itself uses `warmImage()`, never the raw path. Meta/SEO assets (favicons,
> icons, `open-graph.png`) stay at the `public/` root.

## Placement rules — where do I put a new file?

| I am adding… | It goes in… |
|--------------|-------------|
| A route | `app/<route>/page.tsx` — 3 lines, delegates to a view |
| An API endpoint | `app/api/<resource>/route.ts` — see [[api-architecture]] |
| A page's UI | `views/<page-name>.tsx` — see [[new-page]] |
| A reusable design primitive | `components/ui/` |
| Shared infra (provider-dependent) | `components/common/` |
| A feature-specific component | next to the feature, **not** in `components/` |
| A custom hook | `hooks/<domain>/` |
| A pure helper | `utils/<domain>/` |
| A shared type | `types/` |
| Mock/placeholder data | `src/data/mocks/<page-name>.ts` (`legal.ts` ships) |
| A third-party client init | `lib/` |
| A site content asset (image, video) | `public/assets/<section>/` — one folder per section |
| A favicon / icon / OG / manifest asset | `public/` root |

## Do-not-modify zones

`components/animation/springs/` and `hooks/animation/` are the animation engine.
Treat them as a vendored library — consume them, never edit them. See [[animation-system]].

## Related

[[system-overview]] · [[component-conventions]] · [[routing]] · [[agent-harness]]
