---
tags: [architecture, stable]
updated: 2026-10-07
---

# Tech Stack

Every dependency in `package.json`, what it does, and why it is here.
Package name: `next16-claude-starter` · version `0.1.0` · private.

## Core framework

| Package | Version | Role |
|---------|---------|------|
| `next` | `16.3.7` | App Router framework. ⚠️ See warning below. |
| `react` / `react-dom` | `19.3.0` | UI runtime |
| `typescript` | `^5` | Type system — `any` is banned |

> [!warning] This is not the Next.js you may know
> `AGENTS.md` warns: APIs, conventions, and file structure may differ from older
> Next.js knowledge. Always check [[routing]] before writing routing code, and
> heed deprecation notices.

## Styling

| Package | Version | Role |
|---------|---------|------|
| `tailwindcss` | `^4` | Utility CSS — **no `tailwind.config.js`** |
| `@tailwindcss/postcss` | `^4` | PostCSS integration |

Tailwind v4 is configured entirely in `src/app/globals.css` via `@theme inline`.
See [[design-system]].

## Animation (the heart of the starter)

| Package | Version | Role |
|---------|---------|------|
| `@react-spring/web` | `^10.1.2` | Spring physics — drives **all** motion |
| `spring-text-engine` | `^0.1.5` | Scroll-aware spring text animation |

No `framer-motion`, no CSS transitions/keyframes. See [[animation-system]] and
[[text-engine]]. ADR: [[decisions-log]] ADR-0002.

## Scroll & state

| Package | Version | Role |
|---------|---------|------|
| `lenis` | `^1.3.26` | Smooth scrolling |
| `zustand` | `^5.0.15` | Lightweight global state (scroll store) |
| `resize-observer-polyfill` | `^1.5.1` | ResizeObserver fallback for animation hooks |
| `zod` | `^4.6.5` | Schema validation — env (`src/env.ts`) + API payloads. See [[api-architecture]] |

See [[smooth-scroll]] and [[data-flow]].

## Misc

No miscellaneous runtime dependencies. Cookie consent is an in-house component
(`src/components/common/Cookie/`) built on Zustand + `@react-spring/web` — the
former `react-cookie-consent` package was removed. See [[components/common]].

## Tooling

| Package | Role |
|---------|------|
| `eslint` `^9` + `eslint-config-next` | Linting — run `yarn lint` before commits |
| `@types/*` | Type definitions for node/react |

## Scripts

```bash
yarn dev      # next dev — local development
yarn build    # next build — production build
yarn start    # next start — serve production build
yarn lint     # eslint
```

Package manager: **Yarn** (`yarn.lock` is committed).

## Runtime

**Node ≥ 20.19.0**, declared in `package.json` `engines` and pinned for local dev
by `.nvmrc` (24.16.0). Next 16 itself only needs ≥ 20.9, but the ESLint 9
toolchain pulls `eslint-visitor-keys@5`, which requires
`^20.19.0 || ^22.13.0 || >=24` — on Node 20.17 `yarn install` **fails outright**,
which is why the floor is declared rather than left implicit.

## Deliberately held back

Three dependencies are **not** on latest, each for a verified reason (ADR-0022).
Re-test these periodically rather than assuming they are still blocked:

| Package | Held at | Latest | Why |
|---------|---------|--------|-----|
| `typescript` | `^5.9.3` | `7.0.2` | `eslint-config-next` depends on `typescript-eslint@8`, whose peer range is `typescript >=4.8.4 <6.1.0`. TS 7 (the native Go compiler, GA July 2026) would break linting. Revisit when typescript-eslint supports it. |
| `eslint` | `^9.39.4` | `10.11.0` | **Tested and reverted.** ESLint 10 crashes `eslint-plugin-react` (`context.getFilename()` was removed): `TypeError: contextOrFilename.getFilename is not a function`. Three of Next's bundled plugins still declare `eslint ^9` peers. |
| `@types/node` | `^24.19.0` | `26.6.3` | Tracks the Node major actually in use (24), not the newest published. |

## Not in the starter — chosen, but added per project

The starter stays dependency-light; these are the **decided** defaults, installed
only when a project needs them (ADR-0020):

| Need | Choice | Playbook |
|------|--------|----------|
| CMS | Payload (in-app, Next-native) + `@payloadcms/plugin-seo`, `storage-s3`, `richtext-lexical` | [[cms-admin]] · [[cms-payload]] · `/cms` |
| Database | Supabase Postgres | [[database-supabase]] · `/db` |
| File storage | Supabase Storage (S3-compatible) | [[cms-payload]] |
| Auth | Supabase Auth (`@supabase/ssr`) — only with real user accounts | [[database-supabase]] |

> [!note] Payload compatibility — verified 2026-10-07
> The kits are proven on Payload **3.89** (`next >=16.2.6 <17`; 3.90 wants
> ≥ 16.3.3). The starter is on `16.3.7`. Pin every `@payloadcms/*` + `payload` to
> one exact version, and run the Payload CLI on **Node ≥ 22** (on 20.17 it exits
> 0 and does nothing). Re-check when either side moves.

Still undecided: payments, i18n, data-fetching libraries, testing. Document here
when adopted and add an ADR to [[decisions-log]].

## Related

[[system-overview]] · [[folder-structure]]
