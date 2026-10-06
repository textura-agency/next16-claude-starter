// The in-page instrument every canvas probe shares (Chrome via puppeteer's
// evaluateOnNewDocument, WebKit via Playwright's addInitScript). Installed
// before any page script, it:
//  - counts draw calls PER CANVAS (wrapped drawArrays/drawElements…) — a loop
//    that stopped shows as 0 new draws on that canvas;
//  - forces preserveDrawingBuffer so the probe can read pixels back (the
//    default buffer is cleared after compositing and reads as blank) — off
//    with { preserve: false };
//  - records context lost / restored events, canvas width/height attribute
//    writes, window resizes, size messages posted to Workers, and canvases
//    handed to a worker (transferControlToOffscreen — their draws can't be
//    counted on this thread; screenshots judge them);
//  - follows ONE target canvas across re-creation: picked once, marked, and if
//    a rebuild replaces the element, re-found as the canvas overlapping the
//    original's page box the most (the old probes followed "the largest canvas"
//    per step and in landscape jumped to a different one).
// window.__qa is the API the probes call through evaluate().
export function CANVAS_PROBE(opts = {}) {
  const preserve = opts.preserve !== false;
  const qa = (window.__qa = { resize: 0, attr: 0, workerSize: 0, contexts: 0, lost: 0, restored: 0, draws: 0, nextId: 1, targetBox: null });
  const tag = (c) => { if (!c.dataset.qaId) c.dataset.qaId = String(qa.nextId++); return c.dataset.qaId; };
  // Instrument a canvas's fresh context (a plain function, so no `this` alias).
  const instrument = (canvas, ctx, type) => {
    ctx.__qa = true;
    tag(canvas);
    canvas.__qaCtx = ctx; canvas.__qaType = String(type); canvas.__qaDraws = canvas.__qaDraws || 0;
    if (!/webgl/.test(String(type))) return;
    qa.contexts++;
    canvas.addEventListener("webglcontextlost", () => { qa.lost++; canvas.__qaLost = (canvas.__qaLost || 0) + 1; });
    canvas.addEventListener("webglcontextrestored", () => { qa.restored++; });
    for (const fn of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements", "multiDrawArraysWEBGL"]) {
      const f = ctx[fn];
      if (typeof f === "function") ctx[fn] = (...a) => { canvas.__qaDraws++; qa.draws++; return f.apply(ctx, a); };
    }
    // Fault injection (webkit-probe --faults): the next N contexts are lost `delay` ms after creation.
    if (qa.loseNext && qa.loseNext.count > 0) { qa.loseNext.count--; setTimeout(() => ctx.getExtension("WEBGL_lose_context")?.loseContext(), qa.loseNext.delay); }
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs, ...rest) {
    const gl = /webgl/.test(String(type));
    const ctx = getContext.call(this, type, gl && preserve ? { ...(attrs || {}), preserveDrawingBuffer: true } : attrs, ...rest);
    if (ctx && !ctx.__qa) instrument(this, ctx, type);
    return ctx;
  };
  const transfer = HTMLCanvasElement.prototype.transferControlToOffscreen;
  if (transfer) HTMLCanvasElement.prototype.transferControlToOffscreen = function (...a) { tag(this); this.__qaOffscreen = true; return transfer.apply(this, a); };
  addEventListener("resize", () => { qa.resize++; });
  if (window.Worker) {
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data, ...rest) {
      try { if (data && typeof data === "object" && /size/i.test(String(data.type ?? data.kind ?? data.event ?? ""))) qa.workerSize++; } catch {}
      return post.call(this, data, ...rest);
    };
  }
  const watch = () => new MutationObserver((list) => {
    for (const m of list) if (m.target instanceof HTMLCanvasElement && (m.attributeName === "width" || m.attributeName === "height")) qa.attr++;
  }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["width", "height"] });
  if (document.documentElement) watch(); else addEventListener("DOMContentLoaded", watch);

  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const pageBox = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; };
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const visible = (c) => c.width > 8 || c.__qaOffscreen;

  // Everything a probe needs to know about one canvas, without ever creating a context.
  qa.info = (c) => {
    const r = c.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)), visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    let opacity = 1; const flags = [];
    for (let el = c; el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      opacity *= Number(cs.opacity);
      if (cs.visibility !== "visible") flags.push(`${el.tagName.toLowerCase()} visibility:${cs.visibility}`);
      if (cs.display === "none") flags.push(`${el.tagName.toLowerCase()} display:none`);
      if (cs.contentVisibility && cs.contentVisibility !== "visible") flags.push(`${el.tagName.toLowerCase()} content-visibility:${cs.contentVisibility}`);
    }
    const ctx = c.__qaCtx;
    return {
      id: c.dataset.qaId || tag(c), attr: `${c.width}x${c.height}`, box: box(c), parent: c.parentElement ? box(c.parentElement) : null,
      type: c.__qaOffscreen ? "offscreen" : c.__qaType || "none", draws: c.__qaDraws || 0, lostEvents: c.__qaLost || 0,
      lost: ctx && typeof ctx.isContextLost === "function" ? ctx.isContextLost() : null,
      onScreen: r.width > 0 && r.height > 0 && visH > 0 && visW > 0, visibleFrac: r.height ? +(visH * visW / (r.width * r.height)).toFixed(3) : 0,
      opacity: +opacity.toFixed(3), flags,
    };
  };
  qa.all = (sel = "canvas") => [...document.querySelectorAll(sel)].filter((c) => c instanceof HTMLCanvasElement && visible(c)).map(qa.info);

  // Pick the target once: the selector's first match, else the largest canvas on screen now.
  qa.pick = (sel) => {
    const list = [...document.querySelectorAll(sel || "canvas")].filter((c) => c instanceof HTMLCanvasElement && visible(c));
    if (!list.length) return null;
    const area = (c) => { const r = c.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * r.width; };
    const t = sel && sel !== "canvas" ? list[0] : list.sort((a, b) => area(b) - area(a))[0];
    document.querySelectorAll("[data-qa-target]").forEach((e) => e.removeAttribute("data-qa-target"));
    t.setAttribute("data-qa-target", "");
    qa.targetBox = pageBox(t);
    qa.targetSel = sel || "canvas";
    return qa.info(t);
  };
  // The same canvas — or, after a rebuild replaced it, its successor in the same place.
  qa.target = () => {
    let t = document.querySelector("[data-qa-target]");
    if (t && t.isConnected) return t;
    const list = [...document.querySelectorAll(qa.targetSel || "canvas")].filter((c) => c instanceof HTMLCanvasElement && visible(c));
    t = list.map((c) => [c, overlap(pageBox(c), qa.targetBox || { x: 0, y: 0, w: 0, h: 0 })]).sort((a, b) => b[1] - a[1])[0];
    if (!t || t[1] <= 0) return null;
    t[0].setAttribute("data-qa-target", "");
    qa.replaced = (qa.replaced || 0) + 1;
    return t[0];
  };
  qa.targetInfo = () => { const t = qa.target(); return t ? { ...qa.info(t), replaced: qa.replaced || 0 } : null; };
  // Draws on the target over `ms`.
  qa.drawsOver = async (ms) => { const t = qa.target(); const d0 = t?.__qaDraws || 0; await new Promise((r) => setTimeout(r, ms)); const t2 = qa.target(); return t2 === t ? (t2?.__qaDraws || 0) - d0 : (t2?.__qaDraws || 0); };
  // Read the target's drawing buffer back: lit fraction + luminance stddev (−1 when unreadable).
  qa.readback = (c = qa.target()) => {
    try {
      if (!c || c.__qaOffscreen) return { lit: -1, std: -1 };
      const t = document.createElement("canvas"); t.width = 96; t.height = 96;
      const g = t.getContext("2d"); g.drawImage(c, 0, 0, 96, 96);
      const px = g.getImageData(0, 0, 96, 96).data;
      let lit = 0, sum = 0, sq = 0; const n = px.length / 4;
      for (let i = 0; i < px.length; i += 4) { const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; sum += l; sq += l * l; if (l > 40 && px[i + 3] > 0) lit++; }
      const mean = sum / n;
      return { lit: +(lit / n).toFixed(4), std: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(2) };
    } catch { return { lit: -1, std: -1 }; }
  };
  qa.lose = (restoreAfterMs) => {
    const c = qa.target(); const ctx = c?.__qaCtx;
    if (!ctx || typeof ctx.isContextLost !== "function") return "no webgl context on the target";
    if (ctx.isContextLost()) return "already lost";
    const ext = ctx.getExtension("WEBGL_lose_context");
    if (!ext) return "no WEBGL_lose_context";
    ext.loseContext();
    if (restoreAfterMs != null) setTimeout(() => { try { ext.restoreContext(); } catch {} }, restoreAfterMs);
    return "lost";
  };
}

// Hide everything but canvases while a shot is taken (layout untouched — no
// resize), so copy and banners don't mask a blank canvas.
export const ISOLATE_CSS = (sel = "canvas") => `*{visibility:hidden!important}${sel}{visibility:visible!important}`;
export async function isolate(page, on, sel) {
  await page.evaluate(({ on, css }) => {
    let el = document.getElementById("__qa-isolate");
    if (!el) { el = document.createElement("style"); el.id = "__qa-isolate"; document.head.appendChild(el); }
    el.textContent = on ? css : "";
  }, { on, css: ISOLATE_CSS(sel) });
}
