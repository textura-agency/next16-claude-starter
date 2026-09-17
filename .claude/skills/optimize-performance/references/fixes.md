# The fixes

Ordered by how often they are the answer. Apply one, re-measure, then move on.

---

## 1. Warm the page's media before the first scroll

**Symptom.** Assets fetched during the cold scroll; `ImageDecodeTask` present
cold and absent warm; frames drop while the longest main-thread task is ~20ms.

**Why it happens.** Sections are server-rendered from the first frame, but
`next/image` marks anything below the fold `loading="lazy"`. The browser fetches
it only as it nears the viewport — on a first visit, the exact frame it is being
revealed in.

**The fix.** Decode every image the viewport will paint *before* the first
scroll. If the project has an opening loader, hang it off that: the work happens
behind an opaque panel, and the loader's gauge can report real progress.

```ts
/**
 * Decode every image the current viewport will paint.
 *
 * @param onProgress - called as each image lands, for a loader's gauge.
 * @param budgetMs - hard cap; a slow connection must not trap the site.
 */
export const warmMedia = async (
  onProgress?: (p: { done: number; total: number }) => void,
  budgetMs = 3000,
): Promise<void> => {
  if (typeof document === "undefined") return;
  const deadline = performance.now() + budgetMs;
  let done = 0;
  let total = 0;

  // TRAP 1 — layout. Hydration, the webfont and the first layout pass do not
  // land on the same frame. A sweep run too early sees a document one viewport
  // tall in which nothing below the hero has a box, and warms nothing at all.
  await new Promise<void>((resolve) => {
    const until = performance.now() + 2000;
    const check = () => {
      if (document.body.scrollHeight > innerHeight || performance.now() >= until) return resolve();
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });

  const sweep = async () => {
    const fresh = Array.from(document.querySelectorAll("img")).filter(
      // TRAP 2 — an image with no box is a responsive duplicate this breakpoint
      // hides, and it cannot pick a srcset candidate either: warming it would
      // download the LARGEST file of a set whose right answer is the smallest.
      (img) => !img.hasAttribute("data-warmed") && (img.offsetWidth > 0 || img.offsetHeight > 0),
    );
    if (!fresh.length) return 0;
    total += fresh.length;
    onProgress?.({ done, total });

    // TRAP 3 — concurrency. All thirty at once is what a fast link wants and
    // what a slow one cannot give: they share the pipe, none lands early, and
    // thirty decodes arrive together on top of the loader's closing animation.
    // Four at a time in document order means the top of the page is ready first.
    for (let i = 0; i < fresh.length; i += 4) {
      if (performance.now() >= deadline) break;
      await Promise.all(fresh.slice(i, i + 4).map((img) => {
        img.setAttribute("data-warmed", "");
        if (img.loading === "lazy") {
          img.loading = "eager";
          img.setAttribute("fetchpriority", "low");  // the hero still goes first
        }
        // TRAP 4 — await decode(), not load. The decode is the half that costs
        // a frame. It rejects on a broken or replaced source; that is fine.
        const ready = typeof img.decode === "function"
          ? img.decode()
          : Promise.resolve();
        return ready.catch(() => {}).then(() => {
          done += 1;
          onProgress?.({ done, total });
        });
      }));
    }
    return fresh.length;
  };

  // Re-sweep for images that only gained a box later.
  for (let pass = 0; pass < 3; pass += 1) {
    const found = await sweep();
    if (!found || performance.now() >= deadline) break;
  }
};
```

**Budget it honestly.** Keep the cap *under* whatever gates the loader, and let
the warm-up continue in the background when it expires. Holding the site behind a
panel to guarantee a smooth scroll is the wrong trade — a reader who has not
scrolled past the hero yet has seconds of runway either way.

**Do not pre-scroll the page to warm it.** It is the obvious idea and it is
wrong: a pre-scroll consumes every `mode="once"` reveal and `<Inview>` trigger on
the way down, so the animations are over before anyone sees them. Gating each on
a handoff signal would work, but measure first — once media is warm, layout and
raster usually show no cold/warm gap worth the complexity.

---

## 2. Stop the per-frame layout reads piling up

`<SpringTrigger>` and `<ProgressTrigger>` call `getBoundingClientRect` every
frame. A dozen on a page is a dozen forced layouts per frame.

- Raise `frameInterval` on anything that does not need 60fps precision — a
  background parallax at `frameInterval={32}` is indistinguishable.
- Make sure the work is gated on in-view (`useLoopInView`), not running for
  sections three screens away.
- Where several components measure the same element, measure once and share.
- Everything per-frame must go through `src/lib/animation/ticker.ts`. A stray
  `requestAnimationFrame` in a component is a second loop; find it and move it.

`src/components/animation/springs/` and `src/hooks/animation/` are
`#do-not-modify` without sign-off (hard rule 2) — change the *usage* first.

---

## 3. Animate only what the compositor can do

Free: `transform` (`x`, `y`, `scale`, `rotate`) and `opacity`.

Expensive, in rough order: `filter` / `backdrop-filter` (re-rasterises every
frame), `clip-path`, `box-shadow`, and anything that changes layout —
`width`, `height`, `top`, `left`, `margin`.

A spring driving `filter: blur()` across a large element will not hold 60fps on a
phone. Options: animate `opacity` between a pre-blurred and a sharp copy, shrink
the blurred element, or drop the blur below a breakpoint.

`backdrop-filter` is the one to watch in this starter — it is common in scrims
over imagery, and its first rasterisation lands exactly when the section appears.

---

## 4. Load cost

- Hero image `priority`; everything else sized and lazy.
- Every image needs explicit dimensions or a fixed aspect box, or it is a CLS event.
- `next/font` with `display: "swap"`. Never a `<link>` to a font CDN.
- Server Components by default; `"use client"` at the leaves only (hard rule 6).
  One client boundary near the root pulls the whole tree into the bundle.
- `yarn build` prints First Load JS per route. Above ~120KB gz on a marketing
  route, go find out why.
- A `dynamic()` import that resolves on scroll moves the cost into a revealing
  frame. Either preload it at idle, or do not make it dynamic.

---

## 5. Things that look like wins and are not

- **Throwing `will-change` at everything.** Each one is a permanent composited
  layer and GPU memory. Use it on the few elements that genuinely animate, or not
  at all.
- **`content-visibility: auto` on animated sections.** It skips rendering
  off-screen content, which sounds ideal — but the first time a section becomes
  visible it must lay out and paint from scratch, inside the revealing frame.
  That is the §1 problem, re-created by hand.
- **Lowering image `quality` globally.** Decode cost tracks pixel count far more
  than file size. Serve correct `sizes` instead.
- **Debouncing scroll handlers.** Lenis already drives from one rAF; adding a
  debounce makes motion lag without reducing work.
