# The robot path — keep the robot form correct

Crawlers, AI crawlers and lab tools (Googlebot, GPTBot, Lighthouse, PageSpeed)
get the page **without its intro and its motion** — same content, same URL, same
metadata. People are unchanged. The starter ships it; this reference is how to
keep it right as the site grows, and how to check it. Architecture:
`obsidian/frontend/robot-form.md`.

Measured when it was built on production sites: robot mobile 72 → 83 (LCP
3.7 → 2.6 s), 95 → 100 (LCP 2.9 → 1.7 s), robot desktop 84 → 100 and 92 → 100
once root-layout curtains were gated; A11y/BP/SEO 100.

## The pieces

| file | job |
|---|---|
| `src/utils/bot-ua.ts` | `isBotUserAgent(ua)` — one regex for search engines, **AI crawlers** and lab tools; `isBot()` calls it |
| `src/proxy.ts` | bot on `/` → rewrite to `/robot-view`; a person on `/robot-view` → redirect to `/` |
| `src/app/robot-view/page.tsx` | renders the same view with `robot` |
| `src/components/common/robot-view.tsx` | `<RobotView>` (the `<meta name="x-robot-view">` marker + `skipAnimation`), `RobotProvider`, `useRobot()`, `isRobotView()` |
| `robot-spring.tsx`, `robot-inview.tsx`, `robot-hover.tsx`, `robot-text.tsx` | drop-in twins of the engine's primitives that render **at rest** on the robot form; `RobotText lazy` also defers below-fold text engines for people |
| `src/hooks/use-motion-off.ts` | `useMotionOff()` — robot form **or** reduced motion, known on the first render |

## The two lines not to cross

1. **Same content.** Every heading, paragraph, link, image and JSON-LD block of
   the human page is in the robot page. Only motion goes: the preloader, the
   reveals (they jump to their end state), custom cursors, the consent banner
   (no visitor to ask), and a WebGL scene becomes its still. Different
   *content* for crawlers is cloaking.
2. **Static for everyone.** Never `await isBot()` in a page or layout — it reads
   `headers()` and makes the route dynamic for every visitor (no CDN cache);
   one production site did this and 8 of 53 had it. The UA is read in the
   proxy. Check: `curl -sI <url>/ | grep -i 'cache-control\|x-vercel-cache'` —
   `PRERENDER`/`HIT`, not `private, no-store`.

## When you add a route, a section or a scene

- **A new animated route** → add it to the proxy (`/about` →
  `/robot-view/about`), a matching page under `src/app/robot-view/`, and the
  matcher. If `app/<route>/page.tsx` exports its own `metadata`, export the same
  object from the robot page (move it into the view and export from both).
  **Never `noindex` a robot page** — the crawler reads it under the real URL.
- **First-screen sections** import the twins: `Spring` from
  `@/components/common/robot-spring`, `{ RobotText as TextEngine }` from
  `@/components/common/robot-text`, `Inview` / `Hover` from their twins. The
  first screen must be **visible in the server HTML** on the robot form —
  otherwise the robot's LCP only moves from the intro to hydration (observed:
  Render Delay 2.9 s with the hero under a curtain's `invisible` class + a
  clip-path reveal). Pass `robot` to the first screen's own components: the
  curtain starts open, reveal wrappers render plain. `priority` on the LCP
  image (Load Delay 2.7 s → 0).
- **Below-fold text engines** → `RobotText lazy`.
- **Reveals that bypass the engine** (a per-frame hook writing `el.style`, a
  custom timeline): `const robot = useRobot()`, server-render the end state
  (`style={robot ? REST : HIDDEN}`), skip the start (`if (robot) return;`).
  Production Lighthouse caught one mid-fade (1.2:1) that localhost hid.
- **Every loop** (`loop:` springs, `while (alive) await …`, a JS pulse) reads
  `useMotionOff()`. Under `skipAnimation` a loop finishes each lap instantly and
  restarts in the same tick: a hung page (Lighthouse `PAGE_HUNG`) or ~300 ms of
  main thread per load.
- **A preloader in the root layout** can't read the view's context. Mark its
  root `data-preloader`, hide it with
  `html:has(meta[name="x-robot-view"]) [data-preloader] { display: none }`,
  unmount it in a layout effect on `isRobotView()`, and release whatever it
  hands off (the "ready" flag, the intro store's `finish()`). A root-layout
  curtain left ungated showed the robot form its counter ("092"). **Rule**
  (3 sites).
- **Root-layout chrome with entrances** (header, footer): give the animated
  elements `.robot-rest`, and
  `html:has(meta[name="x-robot-view"]) .robot-rest { opacity: 1 !important; transform: none !important; }`.
- **A WebGL scene** → the still (`tools/qa/capture-still.mjs --url …`, look at
  it). A **video + WebGL** layer → one still of the two composited. A scene
  started at module evaluation gates its start on `isRobotView()` after the
  document parses and skips its model preloads on the robot form.
- **A layout chosen after hydration** (`useMediaQuery` → desktop *or* mobile):
  serve both, CSS-switched at the same breakpoint, keep only the match after
  hydration — the wrappers keep their slots, so the visible one never remounts.
  Give both the same `sizes` so their `priority` images share one preload.
- **A layout-level component** (the consent banner) is gated in a layout
  effect, not in render — returning `null` instead of a `dynamic({ ssr: false })`
  element on the first client render is React #418 (BP 100 → 96).

## Check it

```sh
U=http://localhost:3000   # or the deployed URL
curl -s -A "Mozilla/5.0 Chrome/125" $U/ | grep -c 'x-robot-view'          # 0 — people
curl -s -A "Googlebot/2.1" $U/ | grep -c 'x-robot-view'                  # 1
curl -s -A "GPTBot/1.0" $U/ | grep -c 'x-robot-view'                     # 1 — AI crawlers too
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -A "Chrome/125" $U/robot-view   # 307 → /
node tools/qa/lighthouse.mjs --url $U/ --as-bot # the robot's grid (and without the flag: people's)
node tools/qa/check-motion.mjs --url $U/        # reduced motion + robot: the page still answers
```

- Compare `<title>`, canonical and `<h1>` of both forms — they must match.
- **Is the first `<h1>` hidden from a non-JS reader?** Parse the robot HTML and
  check no `hidden` ancestor wraps it (the empty `loading.tsx` did that to most
  sites; remaining streamed Suspense segments can still hide text — the robot
  form should stream nothing).
- **Look** at the robot form on a phone viewport (a plain screenshot with a bot
  UA). The phone is where resting forms go wrong: UI toggles rendered open (a
  menu at rest = open), in-flow text under overlays, screens that hide
  themselves by their own motion.
- Probes for **people** need a plain Chrome UA — puppeteer's default gets the
  robot form. `tools/qa/profile.mjs --as-bot` profiles the robot form's long
  tasks (loop restarts show there).

## Limits

- react-spring renders its **start** values into the server HTML, so robot text
  below the first screen shows at hydration; the JS bundle is unchanged. A
  zero-JS robot page would need the vendored engine to render its `to` state
  under a robot context — not made (the engine is protected).
- Link-preview scrapers (WhatsApp, Slack, X) don't run JS: the build-time
  origin decides their cards (`seo-audit` §2).
