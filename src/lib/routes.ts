// 📖 Docs: obsidian/frontend/seo-metadata.md

/**
 * The route registry — every public page the site serves, in one list.
 *
 * `sitemap.xml`, `/llms.txt` and the breadcrumb JSON-LD all read it, so a page
 * can't be in one and missing from another. `.claude/scripts/verify.sh` FAILs
 * when an `app/**\/page.tsx` has no entry here — a route left out of a
 * hand-kept sitemap array was the most common SEO miss on sites built from
 * this starter.
 *
 * Plain data, no imports: a client component (a nav, a footer) may read it
 * without pulling in `siteConfig` (server-only, it ships zod).
 */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SiteRoute {
  /** The path, no trailing slash (`/`, `/about`, `/services/branding`). */
  path: `/${string}`;
  /** A short name — the breadcrumb, the `/llms.txt` link text, a nav label. */
  label: string;
  /**
   * What the page gives a reader, one sentence — `/llms.txt` lists it. The
   * home page falls back to `siteConfig.description`.
   */
  summary?: string;
  /** `false` keeps it out of `sitemap.xml` and `/llms.txt` (set `noIndex` on its metadata too). */
  indexable: boolean;
  /**
   * When the page's content last really changed — `YYYY-MM-DD`. Omitted → no
   * `<lastmod>`. Never the build time: a date that moves on every deploy
   * teaches Google to ignore the site's dates.
   */
  updated?: string;
  changeFrequency?: ChangeFrequency;
  /** 0–1, relative to the site's other pages. */
  priority?: number;
  /** The parent's path, for the breadcrumb trail. Omitted → the home page. */
  parent?: `/${string}`;
  /**
   * Multi-language sites only (skill: i18n-seo): every language version of
   * this page — hreflang code → path, **its own included** — the same map on
   * each version's entry, e.g. `{ en: "/about", de: "/de/uber-uns" }`.
   * `x-default` → the first listed unless named. Feeds hreflang in `<head>`
   * (`routeLanguages()` in `src/utils/seo/hreflang.ts`) and `sitemap.xml`.
   */
  alternates?: Readonly<Record<string, `/${string}`>>;
}

/**
 * One entry per route in `src/app`. A new page = a new entry here, in the same
 * change (obsidian/workflows/new-page.md). `/robot-view` is never listed — it
 * is served under `/`.
 */
export const ROUTES = [
  {
    path: "/",
    label: "Home",
    indexable: true,
    changeFrequency: "monthly",
    priority: 1,
  },
  {
    path: "/privacy-policy",
    label: "Privacy Policy",
    summary:
      "What the site collects, why, how long it is kept, and the choices a visitor has.",
    indexable: true,
    changeFrequency: "yearly",
    priority: 0.2,
  },
] as const satisfies readonly SiteRoute[];

export type RoutePath = (typeof ROUTES)[number]["path"];

/** The registry entry for a path, if it has one. */
export const findRoute = (path: string): SiteRoute | undefined =>
  (ROUTES as readonly SiteRoute[]).find((route) => route.path === path);

/** Home → … → the page, following `parent`. Unknown paths give `[]`. */
export function routeTrail(path: string): SiteRoute[] {
  const trail: SiteRoute[] = [];
  let current = findRoute(path);
  // The length guard stops a `parent` cycle typed by mistake.
  while (current && trail.length < ROUTES.length) {
    trail.unshift(current);
    if (current.path === "/") break;
    current = findRoute(current.parent ?? "/");
  }
  return trail;
}
