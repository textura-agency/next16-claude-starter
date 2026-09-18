# The fixes, by weight

Performance weights: **TBT 30 · LCP 25 · CLS 25 · FCP 10 · SI 10**. Everything in
"Opportunities" is weight 0 — useful advice, no effect on the number. Fix in this
order and re-measure after each.

---

## Best Practices & SEO — cheap, do these first

### A link to a route that does not exist

The most common and most overlooked. A footer or cookie-banner `href` pointing at
`/privacy-policy` when there is no such route is a 404, a console error (which
fails `errors-in-console`), a broken promise to the reader, and a crawl error.

```sh
grep -rhoE 'href="/[^"#][^"]*"' src/ | sort -u        # every internal link
find src/app -name 'page.tsx'                          # every route that exists
```

Fix by creating the route, not by deleting the link — the cookie banner has to
point somewhere. Keep it a real page: route delegates to a view (hard rule 5), its
own `Metadata`, an entry in `sitemap.ts`. If the copy is boilerplate, **say so in
the file and in the handover** so it reaches legal before launch.

### The rest

- unique `title` + `description` per route; canonical set; OG image resolves absolutely
- every public route in `sitemap.ts`; `robots.ts` allows crawling; no staging `noindex`
- one `<h1>`, clean heading outline, named landmarks, real `button`/`a`, `alt` text

---

## Accessibility — fix the resting state, not the animation

**Read the skill's §3 first.** axe samples once; on an animated page it catches
reveals mid-flight and reports text at `opacity: 0.4` as a contrast failure.
Those are artifacts. What is *not* an artifact is a token that fails at rest.

Audit every `--content-*` token against the surface it names, with the arithmetic
in `runner.md`. Real numbers from this starter's palette:

| token | blended | ratio | verdict |
|---|---|---|---|
| black 20% on `--surface-muted` | `#c4c4c4` | 1.60:1 | fail |
| black 30% on `--surface-muted` | `#acacac` | 2.08:1 | fail |
| black 40% on `--surface-muted` | `#939393` | 2.82:1 | fail |
| white 30% on black | `#4d4d4d` | 2.48:1 | fail |
| black 55% on `--surface-muted` | `#6e6e6e` | 4.68:1 | pass |
| white 52% on black | `#848484` | 5.32:1 | pass |

So the floor is **0.55 for black on the light surfaces, 0.46 for white on black**.
Names like "label", "meta", "subtle" and "faint" read as design intent, which is
exactly why these survive review — they are not subtle, they are unreadable.

**Add a new Tier-1 alpha and repoint the semantic token.** Do not raise the
existing raw value: borders and scrims share it and are held to 3:1, not 4.5:1.

```css
/* Tier 1 — new, alongside the old */
--raw-color-black-alpha-58: rgba(0, 0, 0, 0.58);
--raw-color-white-alpha-52: rgba(255, 255, 255, 0.52);

/* Tier 2 — repoint only the roles that carry words */
--content-on-muted-label: var(--raw-color-black-alpha-58);
--content-on-inverse-faint: var(--raw-color-white-alpha-52);
/* --border-on-inverse-subtle keeps --raw-color-white-alpha-30: it is a border */
```

Same applies to a dimmed state driven from JS — a rotating list whose inactive
items sit at `opacity: 0.2` is 1.6:1 and fails for the same reason.

A contrast change alters how the page looks. Run `qa-verify` and screenshot it.

---

## LCP (weight 25)

**Read the phase breakdown before doing anything** —
`largest-contentful-paint-element` → `details.items[1].items`.

- **Load Delay high** → the image is discovered late. `priority` on the hero, and
  make sure it is not behind JS.
- **Load Time high** → too big, or competing. Check `uses-responsive-images` for
  the variant actually served; a `sizes` that resolves to a 2560px file on a
  768px tablet is a common miss.
- **Render Delay high with Load Time ≈ 0** → it is downloaded and *not painted*.
  Not a network problem. Either the main thread is too busy to paint (go fix TBT),
  or something is covering it.

> **A specific trap.** Any "warm the page's media up front" optimisation — see
> `optimize-performance` — must run **after** `load`, never during. Pulling
> below-the-fold images forward puts them in the same pipe as the hero photo and
> delays `window.load`. Measured on a throttled tablet: LCP 4.9s while warming
> during load, ~2.7s once it was deferred to `requestIdleCallback` after `load`.
> Same work, same benefit, no LCP cost.

---

## CLS (weight 25)

Find the element with the probe in `runner.md`; Lighthouse usually will not name
it. Then:

- **Images** — explicit dimensions or a fixed aspect box, always.
- **Webfonts** — `next/font` only; it generates a size-adjusted fallback so the
  swap does not reflow.
- **Anything that counts up.** A figure animating 0 → 113 grows from one
  character to three and nudges every line beside it. Reserve the final width:

```tsx
<span className="relative inline-block">
  {/* holds the finished width so the line never reflows */}
  <span aria-hidden="true" className="invisible">{target.toFixed(decimals)}</span>
  <span className="absolute inset-0"><CountingFigure … /></span>
</span>
```

- **Anything animated by geometry.** `left` / `top` / `width` / `height` are
  layout, and every frame is a counted shift. Only `transform` and `opacity` are
  free.

> **CLS sums the distance travelled, not the number of frames.** Speeding the
> animation up does *not* reduce it — measured, a stiffer spring produced 39
> larger shifts instead of 46 smaller ones for an identical total. The only fix
> is to stop animating geometry.
>
> Some geometry animations cannot be converted. An element that grows while
> `object-cover` re-crops its photo has no transform equivalent: a non-uniform
> scale distorts the image, and a uniform one cannot reproduce the changing crop.
> When that is the case, **measure the cost, write it down, and give the user the
> choice** — do not silently rewrite their design to win points.

---

## TBT (weight 30) — usually the hardest

Check `mainthread-work-breakdown` and `bootup-time`. If Script Evaluation
dominates and a CPU profile shows no single hot function — just `(program)` and
parse time — the cost is **bundle parse plus hydration**, and there is no clever
local fix.

Levers, in order of what they cost you:

1. **Ship fewer client components.** Server Components by default; `"use client"`
   at the leaves only. One client boundary near the root drags the whole tree in.
2. **Check what is actually in the bundle** — `yarn build` prints First Load JS
   per route. Over ~120KB gz on a marketing route needs an explanation.
3. **Cut the animated-node count.** Per-word text animation creates a DOM node and
   a spring per word; across ten blocks that is hundreds of each. This is a
   **motion-budget decision**, not a bug — raise it with the user rather than
   quietly removing the site's character.
4. **Defer genuinely below-the-fold interactivity** — a heavy form or picker that
   nobody sees on load.

> **Do not assume the loader is the problem.** An opening panel that covers the
> screen for four seconds looks like an obvious LCP and TBT culprit. Measured with
> it removed entirely: TBT moved by ~20ms and two of three profiles scored
> *worse*. Test the hypothesis — it takes ten minutes.

---

## Things that look like wins and are not

- **`will-change` everywhere** — a permanent composited layer and GPU memory each.
- **`content-visibility: auto` on animated sections** — skips off-screen rendering,
  then pays for it in the frame the section appears in.
- **Dropping image `quality` globally** — decode cost tracks pixel count far more
  than file size. Serve correct `sizes` instead.
- **Chasing 100.** Green is ≥ 90. The last few points are usually an audit
  artifact, and the time is better spent on the profile that is actually failing.
