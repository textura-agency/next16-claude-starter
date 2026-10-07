---
tags: [workflow, ai, stable]
updated: 2026-10-07
---

# The Agent Harness (`.claude/`)

The vault is the project's **knowledge**. `.claude/` is its **execution layer** —
the commands, rules, skills, agents and scripts that turn the knowledge into
something an agent actually runs. ADR: [[decisions-log]] ADR-0018.

```
.claude/
├── settings.json      # hooks + permissions
├── scripts/verify.sh  # mechanical rule checks — the only executable gate
├── rules/             # path-scoped context, auto-loaded per file touched
├── skills/            # procedures, loaded on demand by name or description
├── agents/            # subagents with their own context window
└── commands/          # slash commands — thin entry points a human types

tools/qa/              # browser tools: Lighthouse, scroll test, phone probes, axe
                       # (deps in a cache dir outside the project — yarn qa:*)
```

## Which mechanism for what

| Mechanism | Loads when | Use for |
|-----------|-----------|---------|
| **Vault note** | an agent reads it | the *why*, reference, decisions |
| **Rule** (`rules/*.md`) | Claude reads a file matching `paths:` | short, non-negotiable constraints for that area |
| **Skill** (`skills/*/SKILL.md`) | invoked by name, or matched by description | multi-step procedures |
| **Agent** (`agents/*.md`) | delegated to | parallel or context-heavy work |
| **Command** (`commands/*.md`) | a human types `/name` | entry points to the above |
| **Hook** (`settings.json`) | a lifecycle event | enforcement that must not depend on the model deciding |
| **QA tool** (`tools/qa/*.mjs`) | `yarn qa:<name> --url …` | measuring a running production build — [[testing-pipeline]] |

> [!warning] Path-scoped rules fire on **read**, not write
> A `paths:`-scoped rule enters context when Claude *reads* a matching file — not
> when it creates one. A file written from scratch may never trigger its rule. So
> rules reinforce; they do not guarantee. Anything that must hold regardless
> belongs in `verify.sh` or a hook.
> They are also not re-injected after `/compact` until a matching file is read again.

## Rules

| Rule | Scoped to | Carries |
|------|-----------|---------|
| `motion.md` | components, views, layouts | springs-only, CSS exception, text-engine traps |
| `design-tokens.md` | `globals.css`, `src/style/` | the three-tier convention |
| `routing-views.md` | `src/app/`, `src/views/` | route→view delegation, server-first, `proxy.ts` |
| `api-env.md` | `src/app/api/`, `src/lib/api/`, `env.ts` | server-side calls, secrets, zod, envelope |
| `engine-protected.md` | the animation engine | do-not-modify |
| `payload.md` | Payload config, `src/cms/`, `(payload)`, `(site)`, migrations | derived fields + merge, static routes, migrations, Node ≥ 22 |
| `supabase.md` | Supabase clients, `proxy.ts` | connection strings, keys, RLS |
| `scenes.md` | scene / canvas / WebGL files | large-viewport box, width-only resize, dt-scaled motion, no phone frame cap, context recovery |
| `seo-robot.md` | `src/app/`, `proxy.ts`, views, `lib/site.ts` | static routes, robot form, origin, no empty `loading.tsx`, no placeholders |
| `menus.md` | menu / nav files | `h-dvh` + safe area, own colour token, portal under `<body>`, show-then-focus |

## Skills

| Skill | Invoke when | Note |
|-------|-------------|------|
| `qa-verify` | after any UI work, before committing | [[qa-verification]] |
| `figma-to-section` | a Figma URL or frame arrives | [[figma-to-code]] |
| `payload-cms` | adding/changing the CMS — the flow, the kits (`scaffold.sh`) | [[cms-admin]] · [[cms-payload]] |
| `payload-admin` | the admin's look (skin from site tokens) and the editor's guide | [[cms-admin]] |
| `payload-analytics` | consented, self-hosted analytics in the admin | [[cms-admin]] |
| `supabase-db` | database, migrations, RLS | [[database-supabase]] |
| `supabase-auth` | the project needs real user accounts | [[database-supabase]] |
| `seo-audit` | SEO health check or launch prep | [[seo-aeo]] |
| `schema-markup` | structured data | [[seo-aeo]] |
| `aeo-visibility` | AI/answer-engine visibility | [[seo-aeo]] |
| `site-migration` | rebuilding an existing live site | [[site-migration]] |
| `ship-check` | pre-launch gate | [[ship]] |
| `optimize-load` | Lighthouse scores, Core Web Vitals, "get it in the green" | [[optimize-load]] |
| `optimize-performance` | scroll jank or stutter *after* the load | [[optimize-performance]] |
| `optimize-3d-scene` | perf work on a three.js/WebGL scene | [[optimize-3d-scene]] |
| `mobile-device-qa` | iOS / phone hardening: toolbar resize, 120 Hz, context loss, menus, touch | [[mobile-device-qa]] |

The optimisation skills read [[fix-catalog]] and [[pitfalls]] at intake — the
measured history of 50+ sites built from this starter.

## Agents

| Agent | Use for |
|-------|---------|
| `section-builder` | one Figma section each, in parallel |
| `motion-reviewer` | auditing animation-heavy work |
| `vault-librarian` | syncing the vault after a change |
| `seo-auditor` | a full SEO/AEO audit with fixes |

## Commands

`/new-page` · `/section` · `/qa` · `/ship` · `/cms` · `/db` · `/seo` · `/migrate-site` · `/perf` · `/load` · `/mobile`

## QA tools

| Script | Tool | What it measures |
|---|---|---|
| `qa:setup` | `setup.mjs` | installs lighthouse, puppeteer-core, chrome-launcher, axe-core, playwright into the cache dir |
| `qa:lh` | `lighthouse.mjs` | PC + mobile, people + robot form, ×3 medians |
| `qa:scroll` | `scroll-test.mjs` | real wheel / touch scroll, cold + warm, frames > 50 ms with cause and section |
| — | `profile.mjs` | source-mapped CPU profile at a real 4× throttle |
| `qa:ios` | `ios-toolbar-probe.mjs` | Safari toolbar height steps — canvas must not reallocate or blank |
| `qa:fps` | `fps-probe.mjs` | frames a scene really draws vs the display |
| `qa:context` | `context-loss-probe.mjs` | WebGL context loss and recovery |
| `qa:axe` | `axe-sweep.mjs` | contrast + target size every ~120 ms through the entrance |
| `qa:resize` | `resize-check.mjs` | live resize, device mode, rotation vs a fresh load |
| `qa:motion` | `check-motion.mjs` | responsiveness under reduced motion and on the robot form |
| — | `capture-still.mjs` | the scene's still (robot form, share card, phone stills) |
| `qa:brand` | `brand-kit.mjs` | favicon set, manifest, 1200 × 630 share image, head check |
| `qa:webkit` | `webkit-probe.mjs` | the probes in WebKit with an iPhone profile |
| `qa:shots` | `admin-shots.mjs` | the site's screens for the CMS editor's guide (1200 px WebP) |

Flags and setup: `tools/qa/README.md`. All take `--url` of a running `next start`.

## Registering something new

1. Drop it in the right `.claude/` folder.
2. Add a vault note under `workflows/` (or extend an existing one).
3. Link it from [[README]] and from the tables above and in [[ai-agent-guide]].
4. Log it in [[changelog]]; add an ADR if it changes how work is done.

## Related

[[ai-agent-guide]] · [[qa-verification]] · [[testing-pipeline]] · [[mobile-device-qa]] · [[new-page]] · [[decisions-log]]
