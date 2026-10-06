---
tags: [frontend, seo, stable]
updated: 2026-10-06
---

# The robot form

Crawlers, AI crawlers and lab tools (Googlebot, GPTBot, ClaudeBot,
PerplexityBot, Lighthouse / PageSpeed) get the page **without its intro and its
motion** — same content, same URL, same metadata. People are unchanged.

Why: most AI crawlers don't run JavaScript, and a motion-heavy page serves its
copy hidden (reveals at their start state, a curtain over the hero, a scene
that never draws). Measured on production sites: robot-form Lighthouse mobile
72 → 83, 95 → 100, 69 → 93 (TBT 1,176 → 12 ms once every section rendered at
rest), and the robot form's A11y is the page's real accessibility score — it
audits text that people's runs sample mid-reveal. *Rule* (10+ sites).

## The two lines not to cross

1. **Same content.** Every heading, paragraph, link, image and JSON-LD block of
   the human page is in the robot page. Only motion goes: the preloader, the
   spring/text reveals (they rest at their end state), custom cursors, the
   consent banner (no visitor to ask), and a live 3D scene becomes a still.
   Different *content* for crawlers is cloaking.
2. **Static for everyone.** The UA is read in the proxy, never with `headers()`
   in a page: an `await isBot()` in a view renders `/` per request for every
   visitor (`cache-control: private, no-store`, no CDN — measured on 8 sites).

## The pieces

| File | Role |
|------|------|
| `src/utils/bot-ua.ts` | `BOT_UA` + `isBotUserAgent(ua)` — the one list (search, AI crawlers, lab tools) |
| `src/proxy.ts` | bot on `/` → **rewrite** to `/robot-view`; a person on `/robot-view` → redirect `/` |
| `src/app/robot-view/page.tsx` | `<HomeView robot />` — inherits the root metadata, so its canonical is `/` |
| `src/app/robots.ts` | `disallow: /robot-view` (the duplicate path; `/` is still crawled) |
| `src/components/common/robot-view.tsx` | `RobotProvider` / `useRobot()`, `<RobotView/>` (sets `skipAnimation`, renders `<meta name="x-robot-view">`), `isRobotView()` |
| `src/components/common/robot-spring.tsx` | `<Spring>` that renders its `to` state on the robot form (a `mode="always"` toggle rests where `enabled` says — closed menus stay closed) |
| `src/components/common/robot-inview.tsx` | the same for `<Inview>` |
| `src/components/common/robot-hover.tsx` | `<Hover>` resting un-hovered, no controller |
| `src/components/common/robot-text.tsx` | `RobotText` — `spring-text-engine` as plain text in the same tag; `lazy` mounts below-fold engines near the viewport (people too) |
| `src/hooks/use-motion-off.ts` | `useMotionOff()` — reduced motion **or** robot; every loop reads it |
| `src/types/robot-view.d.ts` | `window.__robotView` |

`isBot()` (`src/utils/is-bot.ts`) remains for route handlers that are dynamic
anyway — never in a page.

## Wiring a view

```tsx
// src/views/home.tsx — a Server Component
export const HomeView = ({ robot = false }: { robot?: boolean }) => (
  <RobotProvider robot={robot}>
    {robot && <RobotView />}
    {!robot && <Preloader />}
    <Hero still={robot} />
    …
  </RobotProvider>
);
```

- Import `Spring` / `Inview` / `Hover` from `@/components/common/robot-*` and
  `{ RobotText as TextEngine }` from `@/components/common/robot-text` — in
  **every** section, not just the first screen (hydration is the robot's TBT).
- A 3D scene: `robot` → a still (`next/image`, `priority` if it is the LCP),
  and the WebGL module stays behind `next/dynamic` / `import()` so the robot
  never downloads it. A transparent canvas becomes an opaque still composited
  on the page ground.
- A component that can't read `useRobot()` (root-layout chrome, a scene started
  before React): `isRobotView()` after the document is parsed, or CSS —
  `html:has(meta[name="x-robot-view"]) .robot-rest { opacity: 1; transform: none }`.
- A root-layout preloader: `[data-preloader]` hidden by the same `:has()` CSS,
  unmounted in a layout effect on `isRobotView()`, and whatever it gates
  released.
- A gate in a layout component is decided in a **layout effect**, never in
  render: the layout renders before the page's robot module runs, and a
  first-render `null` mismatches the server HTML (React #418).
- Another animated route → the same pair (`/work` + `/robot-view/work`) and a
  proxy rule. A page that exports its own `metadata` → export the same object
  from its robot page.

## Check it

```sh
U=http://localhost:3000   # a `next start`, or the deploy
curl -s -A "Chrome/125" $U/ | grep -c 'x-robot-view'                    # 0
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" $U/ | grep -c 'x-robot-view'   # 1
curl -s -A "GPTBot/1.2" $U/ | grep -c 'x-robot-view'                    # 1
curl -s -o /dev/null -w '%{http_code}\n' -A "Chrome/125" $U/robot-view  # 307
curl -sI $U/ | grep -i 'cache-control\|x-vercel-cache'                  # static, not private/no-store
```

Compare `<title>`, canonical and `<h1>` of both forms — they must match. The
copy must not sit under a `hidden` ancestor (that was the empty
`app/loading.tsx`, now deleted). **Look** at the robot form on a phone: toggled
UI rendered open, text under overlays and screens that hide themselves by their
own motion are where resting forms go wrong.

## Limits

react-spring renders its start values into the server HTML for any component
not swapped to a `robot-*` twin; the JS bundle is the same for both forms.

## Related

[[seo-metadata]] · [[animation-system]] · [[routing]] · [[components/common]]
