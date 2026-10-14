#!/usr/bin/env node
// SEO crawl — what Lighthouse's SEO score lets through. Lighthouse checks one
// page for the *presence* of a title, a description, a canonical: 11 of 12 live
// sites built from this starter scored SEO 100 while serving localhost as the
// canonical, three titled "New Project". This tool reads the whole site the way
// a crawler does — the served HTML, no JavaScript — and checks the *values*,
// and the site as a graph:
//
//  - robots.txt, sitemap.xml and /llms.txt exist, agree, and name the real origin
//  - every sitemap page answers 200, is indexable, and is linked from another page
//  - per page: one title (≤ 60 chars, unique), a description (70–160, unique),
//    a self-referencing canonical, exactly one h1, JSON-LD that parses,
//    images with alt, no internal link that 404s, ≤ 3 clicks from home
//  - hreflang (multi-language sites only): valid codes, absolute URLs,
//    reciprocal between versions, self-referencing, an x-default, <html lang>
//    agreeing, canonicals that stay in their own language
//  - the robot form (Googlebot UA) carries the same title, description,
//    canonical, h1, JSON-LD and hreflang as the people form — different copy is cloaking
//
//   node tools/qa/seo-crawl.mjs --url http://localhost:4500/
//   node tools/qa/seo-crawl.mjs --url https://example.com/ --max 500
//
// Exit 1 on any FAIL. WARNs are worth reading, not blocking. Pair it with
// `qa:motion` (is the h1 hidden from non-JS crawlers?) and `qa:lh --as-bot`.
import { existsSync, readFileSync } from "node:fs";

import { cli, checkTarget, finish, isLocal } from "./lib/run.mjs";
import { UA } from "./lib/chrome.mjs";

const USAGE = `usage: node tools/qa/seo-crawl.mjs --url <url> [--max 200]`;
const { o, outDir, rel } = cli("seo-crawl", USAGE, { max: { type: "string", default: "200" }, "allow-dev": { type: "boolean" } });
await checkTarget(o.url);

const base = new URL(o.url);
const local = isLocal(o.url);
const MAX = Number(o.max);
const findings = [];
const add = (level, where, issue, fix) => findings.push({ level, where, issue, fix });

// ── HTML reading ─────────────────────────────────────────────────────────────
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const attrs = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? "");
  return out;
};
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const norm = (path) => (path.length > 1 ? path.replace(/\/+$/, "") : path) || "/";

// hreflang values — the same rules as src/utils/seo/hreflang.ts (keep in step).
const COUNTRY_AS_LANGUAGE = { jp: "ja", gr: "el", cz: "cs", dk: "da", ua: "uk", cn: "zh", kr: "ko", vn: "vi", il: "he" };
const NOT_REGIONS = { UK: "GB", EU: "a country", UN: "a country" };
function hreflangProblem(code) {
  if (code === "x-default") return null;
  if (code.includes("_")) return `"${code}": a hyphen, not an underscore`;
  const m = /^([a-z]{2,3})(?:-([A-Z][a-z]{3}))?(?:-([A-Z]{2}|\d{3}))?$/i.exec(code);
  if (!m) return `"${code}" is not language[-Script][-REGION]`;
  const [, language, , region] = m;
  if (COUNTRY_AS_LANGUAGE[language.toLowerCase()]) return `"${language}" is a country code — the language is "${COUNTRY_AS_LANGUAGE[language.toLowerCase()]}"`;
  if (region && /^\d+$/.test(region)) return `"${region}": Google reads ISO 3166-1 alpha-2 regions only`;
  if (region && NOT_REGIONS[region.toUpperCase()]) return `"${region}" is not an ISO 3166-1 region — use ${NOT_REGIONS[region.toUpperCase()]}`;
  return null;
}
const primary = (code) => code.toLowerCase().split("-")[0];

function read(html) {
  const head = html.split(/<\/head>/i)[0];
  const titles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1]).trim());
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (key, value) => metas.filter((a) => (a[key] || "").toLowerCase() === value).map((a) => a.content ?? "");
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1]));
  const ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      const data = JSON.parse(m[1]);
      const nodes = [].concat(data["@graph"] ?? data);
      return { ok: true, types: nodes.map((n) => [].concat(n["@type"] ?? "?").join("/")) };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  const hrefs = [...body.matchAll(/<a\b[^>]*>/gi)].map((m) => attrs(m[0]).href).filter(Boolean);
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => attrs(m[0]));
  return {
    titles,
    description: meta("name", "description"),
    robots: meta("name", "robots").join(",").toLowerCase(),
    canonical: links.filter((l) => (l.rel || "").toLowerCase() === "canonical").map((l) => l.href),
    hreflang: links.filter((l) => (l.rel || "").toLowerCase() === "alternate" && l.hreflang).map((l) => ({ code: l.hreflang, href: l.href ?? "" })),
    lang: attrs(/<html\b[^>]*>/i.exec(html)?.[0] ?? "").lang,
    ogImage: meta("property", "og:image")[0],
    h1s,
    ld,
    hrefs,
    imgsNoAlt: imgs.filter((a) => !("alt" in a)).length,
  };
}

/** A same-site path for an href, or null for external / non-page links. */
function internalPath(href, from, origins) {
  if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return null;
  let u;
  try { u = new URL(href, from); } catch { return null; }
  if (!origins.has(u.origin)) return null;
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico|pdf|xml|txt|json|webmanifest|mp4|webm|woff2?)$/i.test(u.pathname)) return null;
  if (u.pathname.startsWith("/_next/") || u.pathname.startsWith("/api/")) return null;
  return norm(u.pathname);
}

async function get(path, ua = UA.desktop) {
  const url = new URL(path, base).href;
  try {
    const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "manual" });
    const type = res.headers.get("content-type") || "";
    return { status: res.status, location: res.headers.get("location"), type, body: res.status < 300 ? await res.text() : "" };
  } catch (e) {
    return { status: 0, error: e.message, type: "", body: "" };
  }
}

// ── robots.txt, sitemap.xml, llms.txt ────────────────────────────────────────
console.log("  site files");
const robots = await get("/robots.txt");
const sitemap = await get("/sitemap.xml");
const llms = await get("/llms.txt");
let siteOrigin = null;
const sitemapPaths = new Set();

if (robots.status !== 200) add("FAIL", "/robots.txt", `answers ${robots.status}`, "src/app/robots.ts");
else {
  const star = robots.body.split(/\n\s*\n/).find((g) => /user-agent:\s*\*/i.test(g)) || "";
  if (/^disallow:\s*\/\s*$/im.test(star)) add("FAIL", "/robots.txt", "User-agent: * is disallowed from the whole site", "only a staging build may block / — check robots.ts per environment");
  if (!/^sitemap:/im.test(robots.body)) add("WARN", "/robots.txt", "no Sitemap: line", "robots.ts → sitemap");
  const blocked = [...robots.body.split(/\n\s*\n/)].filter((g) => /^disallow:\s*\/\s*$/im.test(g) && !/user-agent:\s*\*/i.test(g)).flatMap((g) => [...g.matchAll(/user-agent:\s*(\S+)/gi)].map((m) => m[1]));
  if (blocked.length) console.log(`    · AI crawlers blocked by policy: ${blocked.join(", ")} (siteConfig.aiCrawlers — the client's decision)`);
}
if (sitemap.status !== 200) add("FAIL", "/sitemap.xml", `answers ${sitemap.status}`, "src/app/sitemap.ts");
else {
  for (const m of sitemap.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const u = new URL(decode(m[1]));
    siteOrigin ??= u.origin;
    sitemapPaths.add(norm(u.pathname));
  }
  if (!sitemapPaths.size) add("FAIL", "/sitemap.xml", "lists no URLs", "ROUTES in src/lib/routes.ts");
  const lastmods = [...sitemap.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  if (lastmods.length > 1 && new Set(lastmods).size === 1 && Date.now() - Date.parse(lastmods[0]) < 864e5) add("WARN", "/sitemap.xml", "every <lastmod> is today — the build time, not content dates", "ROUTES[].updated, or omit");
}
if (siteOrigin && /localhost|127\.0\.0\.1/.test(siteOrigin) && !local) add("FAIL", "/sitemap.xml", `URLs on ${siteOrigin} on a live host`, "set NEXT_PUBLIC_SITE_URL (obsidian/frontend/seo-metadata.md → Origin)");
if (llms.status !== 200) add("WARN", "/llms.txt", `answers ${llms.status}`, "src/app/llms.txt/route.ts");
console.log(`    robots ${robots.status} · sitemap ${sitemap.status} (${sitemapPaths.size} URLs on ${siteOrigin ?? "?"}) · llms.txt ${llms.status}`);

// The site's canonical origin (sitemap) and the origin being tested are both "this site".
const origins = new Set([base.origin, siteOrigin].filter(Boolean));

// ── Crawl ────────────────────────────────────────────────────────────────────
console.log("  crawl (served HTML, no JavaScript)");
const pages = new Map();
const inbound = new Map();
// Links first (breadth-first from home, so depth is real), then any sitemap
// page no link reached — those are the orphans.
const queue = [{ path: "/", depth: 0 }];
const seeds = [...sitemapPaths].map((path) => ({ path, depth: null }));
const seen = new Set();
while ((queue.length || seeds.length) && pages.size < MAX) {
  const { path, depth } = queue.length ? queue.shift() : seeds.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const res = await get(path);
  const page = { path, depth, status: res.status, location: res.location, inSitemap: sitemapPaths.has(path) };
  pages.set(path, page);
  if (res.status >= 300 || !res.type.includes("text/html")) continue;
  Object.assign(page, read(res.body));
  for (const href of page.hrefs) {
    const target = internalPath(href, new URL(path, base).href, origins);
    if (!target || target === path) continue;
    if (!inbound.has(target)) inbound.set(target, new Set());
    inbound.get(target).add(path);
    if (!seen.has(target)) queue.push({ path: target, depth: depth == null ? null : depth + 1 });
  }
  // Language versions are crawled too — after the links, like sitemap seeds.
  for (const { href } of page.hreflang) {
    const target = internalPath(href, new URL(path, base).href, origins);
    if (target && !seen.has(target)) seeds.push({ path: target, depth: null });
  }
}
// Depth for sitemap-seeded pages reached later through links.
for (const [target, froms] of inbound) {
  const p = pages.get(target);
  if (!p || p.depth != null) continue;
  const ds = [...froms].map((f) => pages.get(f)?.depth).filter((d) => d != null);
  if (ds.length) p.depth = Math.min(...ds) + 1;
}
const partial = [...queue, ...seeds].some((q) => !seen.has(q.path));
if (partial) add("WARN", "crawl", `stopped at --max ${MAX} pages — orphan and depth checks skipped`, "raise --max for a whole-site verdict");

// ── Per page ─────────────────────────────────────────────────────────────────
const titles = new Map();
const descriptions = new Map();
for (const p of pages.values()) {
  const where = p.path;
  if (p.status === 0) { add("FAIL", where, "no answer", "is the route built?"); continue; }
  if (p.status >= 400) {
    const from = [...(inbound.get(where) || [])].slice(0, 3).join(", ");
    add("FAIL", where, `answers ${p.status}${from ? ` — linked from ${from}` : ""}${p.inSitemap ? " — and listed in the sitemap" : ""}`, "build the page, or point the link at an existing one (<Link> prefetches it: a console 404 on every page)");
    continue;
  }
  if (p.status >= 300) {
    if (p.inSitemap) add("WARN", where, `in the sitemap but redirects (${p.status} → ${p.location})`, "list the final URL");
    continue;
  }
  if (!p.titles) continue; // not HTML
  const noindex = p.robots.includes("noindex");
  if (noindex && p.inSitemap) add("FAIL", where, "noindex but listed in the sitemap", "set indexable: false in ROUTES, or drop the noindex");
  if (!noindex && !p.inSitemap) add("WARN", where, "indexable page missing from the sitemap", "add it to ROUTES in src/lib/routes.ts");

  const title = p.titles[0];
  if (!title) add("FAIL", where, "no <title>", "generateMetadata({ title })");
  else {
    if (p.titles.length > 1) add("WARN", where, `${p.titles.length} <title> tags`, "one per page");
    if (/TODO|New Project/i.test(title)) add(noindex ? "WARN" : "FAIL", where, `placeholder title "${title}"`, "fill src/lib/site.ts / the page's metadata");
    if (title.length > 60) add("WARN", where, `title ${title.length} chars (search shows ~60): "${title}"`, "lead with the query, brand last");
    if (title.length < 15) add("WARN", where, `title only ${title.length} chars: "${title}"`, "say what the page is");
    if (!noindex) titles.set(title, [...(titles.get(title) || []), where]);
  }
  const desc = p.description[0];
  if (!desc) add("WARN", where, "no meta description", "generateMetadata({ description })");
  else {
    if (desc.length > 160 || desc.length < 70) add("WARN", where, `description ${desc.length} chars (aim 70–160)`, "one sentence on what the reader gets");
    if (!noindex) descriptions.set(desc, [...(descriptions.get(desc) || []), where]);
  }
  const canonical = p.canonical[0];
  if (!canonical) add(noindex ? "WARN" : "FAIL", where, "no canonical", "generateMetadata({ url })");
  else {
    const cu = new URL(canonical, new URL(where, base));
    if (/localhost|127\.0\.0\.1/.test(cu.host) && !local) add("FAIL", where, `canonical on ${cu.origin} on a live host`, "set NEXT_PUBLIC_SITE_URL");
    else if (norm(cu.pathname) !== where) add("WARN", where, `canonical points elsewhere: ${cu.pathname}`, "intended (a duplicate)? otherwise generateMetadata({ url: its own path })");
  }
  if (p.ogImage && /localhost|127\.0\.0\.1/.test(p.ogImage) && !local) add("FAIL", where, `og:image on localhost: ${p.ogImage}`, "set NEXT_PUBLIC_SITE_URL");
  if (p.h1s.length === 0) add("FAIL", where, "no <h1> in the served HTML", "one h1 per page, server-rendered (a robot-text twin if it animates)");
  if (p.h1s.length > 1) add("WARN", where, `${p.h1s.length} <h1>s: ${p.h1s.map((h) => `"${h.slice(0, 40)}"`).join(", ")}`, "exactly one");
  for (const block of p.ld) if (!block.ok) add("FAIL", where, `JSON-LD does not parse: ${block.error}`, "build it with src/utils/seo/structured-data.ts");
  if (!p.ld.length && !noindex) add("WARN", where, "no JSON-LD", "the root layout's site graph is missing?");
  if (p.imgsNoAlt) add("WARN", where, `${p.imgsNoAlt} <img> without alt`, 'meaningful alt, or alt="" when decorative');
  if (!partial && !noindex && where !== "/" && !(inbound.get(where)?.size)) add("WARN", where, "no page links to it (orphan)", "link it from at least 3 related pages, with descriptive anchor text");
  if (!partial && p.depth != null && p.depth > 3) add("WARN", where, `${p.depth} clicks from home`, "keep important pages within 3");
}
for (const [t, ws] of titles) if (ws.length > 1) add("FAIL", ws.join(", "), `share one title: "${t}"`, "a unique title per page");
for (const [, ws] of descriptions) if (ws.length > 1) add("WARN", ws.join(", "), "share one description", "a unique description per page");

// ── hreflang (only pages that declare any) ───────────────────────────────────
const localHost = (u) => /localhost|127\.0\.0\.1/.test(u);
for (const p of pages.values()) {
  if (!p.hreflang?.length) continue;
  const where = p.path;
  const own = [];
  const targets = [];
  for (const { code, href } of p.hreflang) {
    const problem = hreflangProblem(code);
    if (problem) add("FAIL", where, `invalid hreflang ${problem}`, "language[-REGION], ISO 639-1 + ISO 3166-1 (src/utils/seo/hreflang.ts)");
    if (!/^https?:\/\//i.test(href)) { add("FAIL", where, `hreflang="${code}" href is not absolute: "${href}"`, "absolute URLs only — metadataBase / routeLanguages()"); continue; }
    if (localHost(href) && !local) add("FAIL", where, `hreflang="${code}" on localhost: ${href}`, "set NEXT_PUBLIC_SITE_URL");
    const target = internalPath(href, new URL(where, base).href, origins);
    if (target === where) { if (code !== "x-default") own.push(code); }
    else if (target && code !== "x-default") targets.push({ code, target });
  }
  if (!own.length) add("WARN", where, "hreflang set lists every version but this one (no self-reference)", "each version lists itself too — ROUTES[].alternates includes its own path");
  if (!p.hreflang.some((h) => h.code === "x-default")) add("WARN", where, "hreflang without x-default", "x-default → the version for everyone else (routeLanguages() adds it)");
  if (p.lang && own.length && !own.some((c) => primary(c) === primary(p.lang))) add("WARN", where, `<html lang="${p.lang}"> but this page's hreflang is ${own.join("/")}`, "the root layout under [lang] sets lang from the URL");
  const cu = p.canonical?.[0] && norm(new URL(p.canonical[0], new URL(where, base)).pathname);
  if (cu && cu !== where && targets.some((t) => t.target === cu)) add("WARN", where, `canonical points to another language version (${cu})`, "each language version is canonical to itself — a cross-language canonical drops this one from the index");
  for (const { code, target } of targets) {
    const other = pages.get(target);
    if (!other) continue; // past --max
    if (other.status !== 200) { add("FAIL", where, `hreflang="${code}" → ${target}, which answers ${other.status}`, "every listed version must answer 200 and be indexable"); continue; }
    if (!(other.hreflang ?? []).some(({ href }) => internalPath(href, new URL(target, base).href, origins) === where)) add("FAIL", where, `hreflang="${code}" → ${target}, which does not link back (non-reciprocal)`, "give every version the same set — ROUTES[].alternates on each entry");
  }
}

// llms.txt lists every registry page in the sitemap, and nothing the sitemap
// doesn't. CMS collection pages (posts, entries) may be a curated subset —
// llms.txt is a map, not a dump — so only `src/lib/routes.ts` paths must be in it.
if (llms.status === 200 && sitemapPaths.size) {
  const listed = new Set([...llms.body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => { try { return norm(new URL(m[1]).pathname); } catch { return null; } }).filter(Boolean));
  const registryFile = new URL("../../src/lib/routes.ts", import.meta.url);
  const registry = existsSync(registryFile)
    ? new Set([...readFileSync(registryFile, "utf8").matchAll(/path:\s*"(\/[^"]*)"/g)].map((m) => norm(m[1])))
    : null;
  const missing = [...sitemapPaths].filter((p) => !listed.has(p) && (!registry || registry.has(p)));
  const extra = [...listed].filter((p) => !sitemapPaths.has(p));
  if (missing.length) add("WARN", "/llms.txt", `misses sitemap pages: ${missing.join(", ")}`, "both read ROUTES — a hand-written llms.txt?");
  if (extra.length) add("WARN", "/llms.txt", `lists pages not in the sitemap: ${extra.join(", ")}`, "keep the two in step");
  if (/TODO/.test(llms.body)) add("WARN", "/llms.txt", "still holds TODO placeholders", "fill src/lib/site.ts");
}

// ── People vs robot form ─────────────────────────────────────────────────────
console.log("  robot form parity (Googlebot)");
const parity = [];
for (const p of [...pages.values()].filter((x) => x.titles && x.status === 200).slice(0, 30)) {
  const bot = await get(p.path, UA.googlebot);
  if (bot.status !== 200) { add("FAIL", p.path, `Googlebot gets ${bot.status}, people 200`, "src/proxy.ts / robot-view"); continue; }
  const r = read(bot.body);
  const diffs = [];
  if (r.titles[0] !== p.titles[0]) diffs.push(`title "${r.titles[0]}" vs "${p.titles[0]}"`);
  if (r.description[0] !== p.description[0]) diffs.push("description");
  if (r.canonical[0] !== p.canonical[0]) diffs.push(`canonical ${r.canonical[0]} vs ${p.canonical[0]}`);
  if (r.h1s.join("|") !== p.h1s.join("|")) diffs.push(`h1 "${r.h1s.join("|").slice(0, 50)}" vs "${p.h1s.join("|").slice(0, 50)}"`);
  if (r.ld.length !== p.ld.length) diffs.push(`JSON-LD blocks ${r.ld.length} vs ${p.ld.length}`);
  const langs = (x) => x.hreflang.map((h) => `${h.code}=${h.href}`).sort().join(" ");
  if (langs(r) !== langs(p)) diffs.push("hreflang set");
  if (/noindex/.test(r.robots) && !/noindex/.test(p.robots)) diffs.push("robot form is noindex");
  parity.push({ path: p.path, diffs });
  if (diffs.length) add("FAIL", p.path, `robot form differs: ${diffs.join("; ")}`, "same content and metadata for robots (obsidian/frontend/robot-form.md) — different copy is cloaking");
}

// ── Report ───────────────────────────────────────────────────────────────────
const rows = [...pages.values()].filter((p) => p.titles);
console.log(`\n  ${"page".padEnd(28)} ${"st".padEnd(4)} ${"depth".padEnd(6)} ${"in".padEnd(3)} ${"title".padEnd(6)} ${"desc".padEnd(5)} h1  ld`);
for (const p of rows) {
  console.log(`  ${p.path.slice(0, 27).padEnd(28)} ${String(p.status).padEnd(4)} ${String(p.depth ?? "–").padEnd(6)} ${String(inbound.get(p.path)?.size ?? 0).padEnd(3)} ${String(p.titles[0]?.length ?? 0).padEnd(6)} ${String(p.description[0]?.length ?? 0).padEnd(5)} ${String(p.h1s.length).padEnd(3)} ${p.ld.flatMap((b) => b.types ?? ["✖"]).join(",")}`);
}
const fails = findings.filter((f) => f.level === "FAIL");
const warns = findings.filter((f) => f.level === "WARN");
console.log("");
for (const f of [...fails, ...warns]) console.log(`  ${f.level === "FAIL" ? "✖" : "!"} ${f.where} — ${f.issue}\n      → ${f.fix}`);

finish({
  outDir, rel, pass: fails.length === 0,
  result: {
    tool: "seo-crawl", url: o.url, siteOrigin, sitemap: [...sitemapPaths],
    pages: rows.map((p) => ({ path: p.path, status: p.status, depth: p.depth, inbound: inbound.get(p.path)?.size ?? 0, title: p.titles[0], description: p.description[0], canonical: p.canonical[0], hreflang: p.hreflang, lang: p.lang, h1s: p.h1s, jsonLd: p.ld, robots: p.robots })),
    parity, findings,
  },
  summary: `${pages.size} URLs crawled · ${fails.length} FAIL · ${warns.length} WARN`,
});
