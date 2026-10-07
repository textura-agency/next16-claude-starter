// The page's scroller — one definition every tool that scrolls shares.
//
// Most pages scroll the document. Some lock <html>/<body> (overflow hidden) and
// scroll an inner element the size of the screen instead — a `fixed inset-0
// overflow-y-auto` div, or Lenis with its own `wrapper` — usually so iOS's
// toolbar never collapses. On such a page `scrollY` stays 0, the document is
// exactly one screen tall and `window.scrollTo` does nothing. Every tool that
// asked the window then read the page as "static / one screen, 0 px scrolled"
// and PASSED it without having scrolled a pixel (observed on a production
// site). So:
//
//   - SCROLLER is installed in the page before any page script
//     (`installScroller(page)` — puppeteer or Playwright) and defines
//     window.__scroller() and friends; every in-page read of the scroll
//     position goes through them;
//   - the node-side helpers below scroll through them;
//   - `zeroScroll()` turns "a long page that scrolled 0 px" into an error —
//     never a pass.
//
// On a window-scrolled page every helper is exactly the old window call.

/**
 * In-page snippet. Self-contained (it is serialised into the page).
 *   __scroller(fresh)  the scrolling element: Lenis's own wrapper element if
 *                      Lenis runs on one; else the document when it is taller
 *                      than the viewport; else the first overflow-y:auto|scroll
 *                      element ≥ 75 % of the screen tall whose content is
 *                      taller than its box (cached; the shallow search — four
 *                      levels under <body> — runs at most every 500 ms, and
 *                      `fresh` also searches the whole tree); else the document.
 *   __isDoc(s)         s is the document's scrolling element
 *   __sy() / __vh()    scroll position / visible height of the scroller
 *   __max()            the scroll range (0 = nothing to scroll)
 *   __to(y) / __by(dy) / __top()   move it (through Lenis when Lenis runs)
 *   __stepTo(y, px, ms)  move in steps of px every ms (0 = every frame), so
 *                      the page's own scroll handlers fire as for a visitor
 *   __yOf(el)          an element's offset in the scroller's content
 *   __locked()         the scroller can't move now (overflow hidden, Lenis stopped)
 *   __describe()       "document" or a short selector-ish name
 *   __unclaimed()      a scrollable element the size of most of the screen
 *                      that is NOT the scroller — the tell of a long page this
 *                      file failed to find
 */
export function SCROLLER() {
  if (window.__scroller) return;
  const doc = () => document.scrollingElement || document.documentElement;
  const isDoc = (s) => !s || s === document.scrollingElement || s === document.documentElement || s === document.body;
  const scrollable = (el, minH) => el.clientHeight >= minH && el.scrollHeight > el.clientHeight + 16 && /auto|scroll|overlay/.test(getComputedStyle(el).overflowY);
  window.__isDoc = isDoc;
  window.__scroller = (fresh) => {
    const se = doc();
    const c = window.__scrollerCache;
    if (c && c.isConnected && c.scrollHeight > c.clientHeight + 16) return c;
    const w = window.lenis && window.lenis.options && window.lenis.options.wrapper;
    if (w && w.nodeType === 1) return (window.__scrollerCache = w);
    if (se.scrollHeight > innerHeight + 16) return se;
    const now = performance.now();
    if (!fresh && now - (window.__scrollerProbe || -1e9) < 500) return se;
    window.__scrollerProbe = now;
    if (!document.body) return se;
    for (const el of document.body.querySelectorAll(":scope > *, :scope > * > *, :scope > * > * > *, :scope > * > * > * > *")) {
      if (scrollable(el, innerHeight * 0.75)) return (window.__scrollerCache = el);
    }
    if (fresh) for (const el of document.body.querySelectorAll("*")) {
      if (scrollable(el, innerHeight * 0.75)) return (window.__scrollerCache = el);
    }
    return se;
  };
  window.__sy = () => { const s = window.__scroller(); return isDoc(s) ? scrollY : s.scrollTop; };
  window.__vh = () => { const s = window.__scroller(); return isDoc(s) ? innerHeight : s.clientHeight; };
  window.__max = () => Math.max(0, window.__scroller().scrollHeight - window.__vh());
  window.__to = (y) => {
    const s = window.__scroller();
    if (window.lenis && typeof window.lenis.scrollTo === "function") return window.lenis.scrollTo(y, { immediate: true, force: true });
    return isDoc(s) ? scrollTo(0, y) : s.scrollTo(0, y);
  };
  window.__by = (dy) => { const s = window.__scroller(); return isDoc(s) ? scrollBy(0, dy) : s.scrollBy(0, dy); };
  window.__top = () => window.__to(0);
  window.__stepTo = async (goal, px = 40, ms = 0) => {
    const wait = () => new Promise((r) => (ms ? setTimeout(r, ms) : requestAnimationFrame(r)));
    goal = Math.max(0, Math.min(window.__max(), goal));
    let last = -1, guard = 2000;
    while (Math.abs(goal - window.__sy()) > 2 && guard-- > 0) {
      const y = window.__sy();
      if (y === last) break;            // pinned or locked: stop, the caller judges
      last = y;
      const s = window.__scroller(), next = goal > y ? Math.min(goal, y + px) : Math.max(goal, y - px);
      if (isDoc(s)) scrollTo(0, next); else s.scrollTop = next;   // native: Lenis follows native scroll
      await wait();
    }
    return window.__sy();
  };
  window.__yOf = (el) => {
    const s = window.__scroller();
    const top = isDoc(s) ? 0 : s.getBoundingClientRect().top;
    return el.getBoundingClientRect().top - top + window.__sy();
  };
  window.__locked = () => {
    const s = window.__scroller(), l = window.lenis;
    const hidden = (el) => !!el && /hidden|clip/.test(getComputedStyle(el).overflowY);
    if (l) return !!(l.isStopped || l.isLocked);
    return isDoc(s) ? hidden(document.documentElement) || hidden(document.body) : hidden(s);
  };
  window.__describe = () => {
    const s = window.__scroller();
    if (isDoc(s)) return "document";
    const cls = typeof s.className === "string" ? s.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${s.tagName.toLowerCase()}${s.id ? "#" + s.id : cls ? "." + cls : ""}`;
  };
  window.__unclaimed = () => {
    const s = window.__scroller(true);
    for (const el of document.querySelectorAll("body *")) {
      if (el === s || el.clientHeight < innerHeight * 0.5 || el.scrollHeight < el.clientHeight * 1.5) continue;
      if (scrollable(el, innerHeight * 0.5)) {
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
        return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : cls ? "." + cls : ""} (${el.clientHeight}px box, ${el.scrollHeight}px content)`;
      }
    }
    return null;
  };
}

/** Install SCROLLER before any page script: puppeteer (evaluateOnNewDocument) or Playwright (addInitScript). */
export async function installScroller(page) {
  if (typeof page.evaluateOnNewDocument === "function") await page.evaluateOnNewDocument(SCROLLER);
  else await page.addInitScript(SCROLLER);
}
/** Define it on the current document too (a no-op when the init script already ran). */
export const ensureScroller = (page) => page.evaluate(SCROLLER);

/**
 * Where the scroller is: { y, max, vh, scroller, unclaimed } — `scroller` is
 * "document" or an element name; `unclaimed` names a big scrollable element
 * that is not the scroller when the page otherwise reads as one screen.
 */
export async function scrollState(page) {
  await ensureScroller(page);
  return page.evaluate(() => {
    window.__scroller(true);
    const max = Math.round(window.__max());
    return { y: Math.round(window.__sy()), max, vh: Math.round(window.__vh()), scroller: window.__describe(), unclaimed: max <= 16 ? window.__unclaimed() : null };
  });
}

/**
 * "A long page that scrolled 0 px" as an error message, else null.
 * `from` / `to` are scrollState()s; `goal` the y the caller asked for;
 * `wanted` whether the caller meant to move at all (default: goal ≠ start).
 */
export function zeroScroll(from, to, goal = to.max, wanted = Math.abs(goal - from.y) > 2) {
  if (!wanted) return null;                                  // nothing was asked of it
  if (from.max <= 16 && from.unclaimed) return `the page reads as one screen, but ${from.unclaimed} scrolls — a long page this tool cannot move; nothing below its first screen is measured`;
  if (from.max <= 16 && to.max <= 16) return null;
  if (Math.abs(goal - from.y) <= 2) return null;
  if (Math.abs(to.y - from.y) > 2) return null;
  return `the page is ${from.max} px longer than its screen but scrolled 0 px (scroller: ${to.scroller}) — the scroll never reached it; nothing measured below the first screen is real`;
}

async function go(page, goal, { stepPx = 0, stepMs = 0, settle = 0, wanted } = {}) {
  const from = await scrollState(page);
  const y = Math.max(0, Math.min(from.max, Math.round(goal)));
  if (stepPx) await page.evaluate(([y, px, ms]) => window.__stepTo(y, px, ms), [y, stepPx, stepMs]);
  else await page.evaluate((y) => window.__to(y), y);
  if (settle) await new Promise((r) => setTimeout(r, settle));
  const to = await scrollState(page);
  return { ...to, from: from.y, goal: y, error: zeroScroll(from, to, y, wanted ?? Math.abs(Math.round(goal) - from.y) > 2) };
}

/**
 * Scroll to `f` (0…1) of the page's scroll range. { stepPx, stepMs } scrolls in
 * steps (stepMs 0 = one step per frame) so scroll handlers fire as for a
 * visitor; else one jump. Returns { y, max, vh, scroller, goal, error } —
 * `error` is set when a long page did not move at all.
 */
export async function scrollToFraction(page, f, opts) {
  const s = await scrollState(page);
  return go(page, s.max * f, { wanted: f > 0 && Math.abs(s.max * f - s.y) > 2 || (f > 0 && !!s.unclaimed), ...opts });
}
/** Scroll to a y offset in the scroller's content. Same return as scrollToFraction. */
export const scrollToY = (page, y, opts) => go(page, y, opts);
/**
 * Scroll an element into view: `block` "start" (its top at the top) or
 * "center". Returns null when nothing matches the selector.
 */
export async function scrollToSelector(page, sel, { block = "start", ...opts } = {}) {
  await ensureScroller(page);
  const y = await page.evaluate(([sel, block]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const top = window.__yOf(el);
    return block === "center" ? top - (window.__vh() - el.getBoundingClientRect().height) / 2 : top;
  }, [sel, block]);
  return y == null ? null : go(page, y, opts);
}
