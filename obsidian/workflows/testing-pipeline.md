---
tags: [workflow, testing, performance, qa, stable]
updated: 2026-10-06
---

# Workflow — The testing pipeline

The order in which a site built from this starter is measured before anyone calls
it fast, accessible or done — and the bars it must clear. It is the procedure that
took 50+ production sites to **Performance ≥ 90 on PC and mobile, Accessibility /
Best Practices / SEO 100, and an ideal scroll**, and the order matters: each step
catches what the one before it cannot see.

Tools: `tools/qa/` (setup and flags in `tools/qa/README.md`). They install their
own dependencies (lighthouse, puppeteer-core, chrome-launcher, axe-core,
playwright) into a cache directory **outside** the project — the starter gains no
dependency. Every tool takes `--url` pointing at a running `next start`.
ADR: [[decisions-log]] ADR-0026.

> [!important] No instrument here sees what a person sees on a phone
> Lighthouse doesn't scroll, the scroll test runs Chrome on a laptop GPU, and
> none of it is Safari. Every phone defect in [[fix-catalog]] §9 was found by a
> person on an iPhone **after** every number said "done". The last step — a real
> device — is not optional. See [[mobile-device-qa]].

## The bars

| | Bar | Where |
|---|---|---|
| **Performance** | **≥ 90 on PC and on mobile** (green is ≥ 90, not 100) | people runs, real host |
| **Accessibility, Best Practices, SEO** | **100** on PC and mobile | **both** people runs and the robot form |
| **Scroll** | **ideal** on PC and mobile: no frame > 50 ms · ≤ 1 % dropped · p99 ≤ 33 ms, cold **and** warm pass | real host |
| **Phone** | the [[mobile-device-qa]] checks pass, and a person has looked on a real iPhone | device |

If the design caps a number (a motion, a video, a scene), record the number and
the reason and let the client decide — never change the design to win points.

## 0. Once per machine

```sh
yarn qa:setup            # installs the QA toolchain into the cache dir
```

## 1. Build

```sh
yarn build && yarn start -p <port>
```

- **Never measure `next dev`.** Dev serves chunks eagerly, double-mounts under
  StrictMode and doesn't hydrate on `127.0.0.1` ([[pitfalls]] §2).
- Gate `start` on the build's exit code — a failed build leaves the old `.next`
  to serve, and your A/B compares the old build with itself.
- Kill every old server first (by port: `next start` is `next-server`).
- Note the machine's load (`sysctl -n vm.loadavg`); above ~15, re-run later.

## 2. Lighthouse — PC + mobile, people + robot, ×3

```sh
yarn qa:lh --url http://localhost:<port>/
```

| | PC | Mobile |
|---|---|---|
| viewport | 1440 × 900 @1× | 412 × 823 @1.75× |
| network | 40 ms RTT, 10 Mbps | slow 4G: 150 ms RTT, 1.6 Mbps |
| CPU | 1× | **4× slowdown** |

- **≥ 3 runs per profile, median per metric.** Read the spread; > ~8 points of
  spread → 5 runs. A tablet profile exists for digging, not for the record.
- **Two forms.** *People* runs send a plain Chrome UA and get the real page.
  *Robot* runs send Lighthouse's own UA — what a person running PageSpeed or
  DevTools Lighthouse gets — and the proxy serves the **robot form** (same
  content, at rest, no loader, no scene). A11y/BP/SEO must be 100 on both.
- Read the LCP element and its phases (TTFB / Load Delay / Load Time / Render
  Delay), `long-tasks`, `bootup-time`, `network-requests`, failing audits. Map
  long tasks to code by the **observed** trace, not the simulated times.
- To find *why* a task is long: `node tools/qa/profile.mjs --url …` (a
  source-mapped CPU profile at a real 4× throttle, people UA).
- Local numbers are for iterating. Localhost LCP is a floor (31 s hosted vs 4.8 s
  local, once) — and sometimes over-billed. **The record is step 6.**

## 3. Scroll test — PC + mobile, first and second visit

```sh
yarn qa:scroll --url http://localhost:<port>/
```

| | PC | Mobile |
|---|---|---|
| viewport | 1440 × 900 @2× | 390 × 844 @3×, touch |
| input | real wheel bursts of ~1 viewport | touch flings of 55 % of the viewport |
| CPU / network | 1× | 4×, 4G |

- A **visible** Chrome window (headless GPU behaviour differs), a fresh profile
  per run (cold is honestly cold), a warm-up pass discarded, then a **cold pass**
  top → bottom and a **warm pass**; ×3.
- It waits until the page truly scrolls (a probe scroll that moves), so loaders
  are waited out; `readyMs` reports how long the page was locked.
- Every frame > 50 ms is reported with its **section**, how many runs reproduced
  it (3/3 is a bug, 1/3 may be noise) and its **cause**: `decode` (media fetched
  just before), `gpu / raster` (main thread idle), `script` (names the file and
  function), `script: React render` / `mounting a lazy chunk`, `render`.
- **Cold bad, warm clean** = first-visit work in animating frames. **Both bad** =
  steady per-frame cost. Coverage < 95 % = `incomplete`, not a verdict.
- For a page with a loader, also wheel **from the unlock frame** — people do, and
  the test starts ~1 s later.
- Fixes, by cause: [[fix-catalog]] §4–5; procedure: [[optimize-performance]],
  [[optimize-3d-scene]].

## 4. Mobile and iOS probes

Chrome-based probes for what the scroll test can't see. Run them on any page with
a WebGL scene, a full-screen menu or a loader — details in [[mobile-device-qa]].

```sh
yarn qa:ios --url …        # Safari toolbar: viewport height stepped while scrolled; canvas must not reallocate or blank
yarn qa:fps --url …        # frames the scene really draws vs the display's rAF, at rest and while scrolling
yarn qa:context --url …    # WebGL context lost off-screen / on-screen — the hero must come back
yarn qa:resize --url …     # live window resize, DevTools device mode, rotation — lands where a fresh load does
yarn qa:motion --url …     # reduced motion + robot form: the page must stay responsive (looping springs hang it)
yarn qa:webkit --url …     # the same checks in WebKit (iPhone profile) for iOS-only bugs
```

Plus, by hand or scripted: `document.documentElement.scrollWidth === innerWidth`
at 360–430 px; open/close every overlay with `prefers-color-scheme: dark`
emulated.

## 5. Accessibility sweep

```sh
yarn qa:axe --url …
```

axe colour-contrast + target-size **every ~120 ms from navigation** on both
devices, people UA. Lighthouse samples once, at a moment that differs per run —
so a fading entrance flips A11y 96 ↔ 100, and an element at opacity 0 when it
looked is never audited. The sweep lists every node that ever fails; a node
failing in the **last sample** fails at rest — a real defect even when Lighthouse
reads 100. Fixes: [[fix-catalog]] §7.

## 6. Real host

Deploy a preview (Vercel) and repeat steps 2–3 against it (`--url https://…`) —
**this is the record.** Then check what only a host shows:

```sh
curl -sI https://<host>/ | grep -i 'cache-control\|x-vercel-cache'   # / must be static (PRERENDER/HIT), not private, no-store
curl -s  https://<host>/ | grep -o 'rel="canonical"[^>]*'           # the real origin, never localhost
curl -s -A "GPTBot" https://<host>/ | …                              # the <h1> and copy outside any `hidden` element
```

Take `og:image` from the live page and curl it (200). Open `/robots.txt` and
`/sitemap.xml`. Run the robot Lighthouse on the host too — a custom reveal clock
that ignores the robot switch finishes on localhost before the snapshot and is
caught mid-fade only on production. Take records in a quiet window.

## 7. Real device

Open the preview on an iPhone (and an Android if you have one) and walk
[[mobile-device-qa]]'s device list: scroll the whole page and back, change scroll
direction, open the menu, rotate, leave and return to the tab, check dark mode,
check the scene's speed and frame rate by eye. **Nothing is "done" before this.**

## Brand check (before launch)

```sh
yarn qa:brand --url …      # favicon set, manifest, 1200×630 share image from the composed hero; checks the rendered <head>
node tools/qa/capture-still.mjs --url …   # the scene's still for the robot form / share card
```

Look at the share image and the 32 px / 180 px icons yourself. Title = brand +
what it is; description from the site's own copy; no placeholder author/handle.

## Reporting

Per change: before → after for each profile (perf, LCP, TBT, CLS; scroll verdict,
worst frame, % dropped), runs, local or hosted, the machine's load. What you
reverted and why. What you could not verify (iOS-only behaviour — say so). Log it
in [[changelog]]; a new measured fix goes into [[fix-catalog]] by the rules in
[[knowledge/README]].

## Related

[[mobile-device-qa]] · [[optimize-load]] · [[optimize-performance]] ·
[[optimize-3d-scene]] · [[qa-verification]] · [[ship]] · [[fix-catalog]] · [[pitfalls]]
