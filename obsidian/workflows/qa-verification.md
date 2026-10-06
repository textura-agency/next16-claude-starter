---
tags: [workflow, qa, stable]
updated: 2026-10-06
---

# Workflow — QA & Verification

How work in this repo is checked before it is called done. Four layers: a script
for the rules a grep can decide, a judgement pass for the ones it can't, the
browser tools for what only a running page shows, and a real phone for what no
tool shows. ADRs: [[decisions-log]] ADR-0019, ADR-0026.

## Layer 1 — `.claude/scripts/verify.sh`

```bash
.claude/scripts/verify.sh                     # whole src/
.claude/scripts/verify.sh src/views/about.tsx # scoped
```

Exit code 1 on any **FAIL**. **WARN**s never fail the run — they are judgement
calls that must be fixed or justified, not ignored.

What it decides mechanically:

| Group | Checks |
|-------|--------|
| Motion | `@keyframes`, foreign animation libs, `mode="manual"`, `leading-none`+`overflow`, dead `duration-fast` class, untokenised transitions |
| Tokens | hex in `className`/`style`, arbitrary px, literals in `@theme inline` or a Tier 2 token |
| Architecture | route importing outside `views/`, `"use client"` on page/layout/view, `any`, `next/router`, `middleware.ts`, `process.env` outside `env.ts` |
| Markup | raw `<img>`, missing `alt`, raw `<a>` internal link, click handler on a `div`, multiple `<h1>`, `tag="div"` |
| Hygiene | `console.log`, TODO/FIXME, **any diff inside the vendored animation engine** |

It is deliberately conservative: it greps source, it does not parse TypeScript, so
it can miss things and occasionally flags a legitimate case. Prefer a false
positive you dismiss over a rule nobody checks.

> [!note] It does not replace `yarn lint` or `yarn build`
> Run all three. The script checks *this project's* rules; the compiler and
> linter check the language.

## Layer 2 — the `qa-verify` skill

The checks a script cannot make: design fidelity against a **re-fetched** Figma
node, whether a token is named for its purpose, whether the chosen spring
primitive is the right one, semantics and heading outline, responsive behaviour
down to 320px, and whether content genuinely arrives via props.

The loop: run layer 1 → fix every FAIL → walk layer 2 section by section → re-run
layer 1 (fixes introduce violations) → repeat until clean.

## Layer 3 — the browser tools (`tools/qa/`)

What only a running production build shows. Full order and bars:
[[testing-pipeline]]. After any **visual** change, at minimum:

| Check | Tool | Catches |
|---|---|---|
| Responsive + live resize | `yarn qa:resize --url …` | a layout or scene that only looks right on a fresh load — a DevTools device toggle or a window drag left a model at desktop size on one site |
| Phone overflow | `scrollWidth === innerWidth` at 360–430 px | a section wider than the phone zooms the whole page out |
| Reduced motion + robot form | `yarn qa:motion --url …` | a `loop:` spring or `await`-spring loop that hangs the tab under `skipAnimation` |
| Contrast + target size through the entrance | `yarn qa:axe --url …` | text sampled mid-fade, and at-rest failures Lighthouse never audits (over a canvas, below the fold) |
| Dark mode | emulate `prefers-color-scheme: dark`, open every overlay | a theme-following menu background under fixed-colour text |
| Phone scene behaviour | `yarn qa:ios` / `qa:fps` / `qa:context` | [[mobile-device-qa]] |

Look at the screenshots yourself — a scaffolded CSS edit once blanked a page
while tsc, lint, build and verify all passed. Probe with a plain Chrome UA:
headless Chrome's default UA gets the robot form ([[pitfalls]] §2).

## Layer 4 — a real phone

Open the preview on an iPhone and walk the device list in [[mobile-device-qa]].
On 50+ production sites a person's phone review found what every instrument had
passed — a flickering scene, a 26 fps cap, a menu under Safari's toolbar. If no
device is available, the report says so.

## When it runs

- `/qa` — on demand
- inside `/new-page` and `/section` before they report done
- inside `/ship` as the first gate
- by the `section-builder` agent before it hands back

## Known gaps

- No visual regression testing — no baseline screenshots, so "matches the design"
  remains a human/model judgement. Compare before/after stills of anything you
  changed, on both devices.
- axe runs on demand (`qa:axe`, Lighthouse), not in CI. Focus order is still
  checked by inspection.
- No instrument is Safari on a phone — `qa:webkit` narrows that gap, the device
  closes it.
- No unit or E2E tests in the project at all. If that changes, this workflow is
  where the gate belongs.

## Related

[[testing-pipeline]] · [[mobile-device-qa]] · [[pitfalls]] · [[agent-harness]] · [[new-page]] · [[ship]] · [[ai-agent-guide]]
