/**
 * @fileoverview hreflang — the language versions of a page, for `<head>` and
 * the sitemap. 📖 Docs: obsidian/frontend/seo-metadata.md · skill: i18n-seo
 *
 * Opt-in: a single-language site never calls this and emits no hreflang.
 * A multi-language page lists *every* version of itself, its own included,
 * in `ROUTES[].alternates` (`src/lib/routes.ts`); `routeLanguages(path)` turns
 * that into the `alternates.languages` map `generateMetadata({ languages })`
 * and `sitemap.ts` take — with `x-default` added. Each version carries the
 * same cluster, so the links are reciprocal by construction (a one-way
 * hreflang is ignored by Google). `yarn qa:seo` checks the served result.
 *
 * Plain functions over plain data — no `siteConfig` — so client code may use
 * it too. Paths stay relative here; `metadataBase` / the sitemap make them
 * absolute.
 */

import { findRoute } from "@/lib/routes";

export const X_DEFAULT = "x-default";

/*
  Country codes people write where the language code belongs. Each is either
  not an ISO 639-1 code at all or a different language — Google ignores the
  tag, or files the page under the wrong language.
*/
const COUNTRY_AS_LANGUAGE: Record<string, string> = {
  jp: "ja",
  gr: "el",
  cz: "cs",
  dk: "da",
  ua: "uk",
  cn: "zh",
  kr: "ko",
  vn: "vi",
  il: "he",
};

/** Regions that are not ISO 3166-1 alpha-2 codes, though they look like one. */
const NOT_REGIONS: Record<string, string> = { UK: "GB", EU: "a country", UN: "a country" };

/**
 * Why an hreflang value is wrong, or `null` when it is valid: an ISO 639-1
 * language (`de`), optionally a script (`zh-Hant`) and an ISO 3166-1 region
 * (`en-GB`), hyphen-separated — or `x-default`. Google reads only alpha-2
 * regions: a UN M.49 one like `es-419` is ignored.
 */
export function hreflangProblem(code: string): string | null {
  if (code === X_DEFAULT) return null;
  if (code.includes("_")) return `"${code}": a hyphen, not an underscore (${code.replace(/_/g, "-")})`;
  const match = /^([a-z]{2,3})(?:-([A-Z][a-z]{3}))?(?:-([A-Z]{2}|\d{3}))?$/i.exec(code);
  if (!match) return `"${code}" is not language[-Script][-REGION]`;
  const [, language, , region] = match;
  const swap = COUNTRY_AS_LANGUAGE[language.toLowerCase()];
  if (swap) return `"${language}" is a country code — the language is "${swap}"`;
  if (region && /^\d+$/.test(region)) return `"${region}": Google reads ISO 3166-1 alpha-2 regions only — list each country`;
  const notRegion = region && NOT_REGIONS[region.toUpperCase()];
  if (notRegion) return `"${region}" is not an ISO 3166-1 region — use ${notRegion}`;
  return null;
}

/**
 * The `alternates.languages` map for one page: every version (its own
 * included), plus `x-default` → the `defaultLanguage` version (the first
 * listed when omitted) unless the cluster names one. Throws on an invalid
 * code or a cluster that leaves the page out — a build that fails beats a
 * cluster Google silently drops.
 */
export function languageAlternates(
  path: string,
  versions: Readonly<Record<string, string>>,
  defaultLanguage?: string,
): Record<string, string> {
  const codes = Object.keys(versions);
  const problems = codes.map(hreflangProblem).filter((p): p is string => p !== null);
  if (problems.length > 0) throw new Error(`[hreflang] ${path}: ${problems.join("; ")}`);
  if (!Object.values(versions).includes(path)) {
    throw new Error(`[hreflang] ${path}: its alternates must list the page itself`);
  }
  if (X_DEFAULT in versions || codes.length === 0) return { ...versions };
  const fallback = versions[defaultLanguage ?? codes[0]];
  if (fallback === undefined) {
    throw new Error(`[hreflang] ${path}: default language "${defaultLanguage}" is not among its versions`);
  }
  return { ...versions, [X_DEFAULT]: fallback };
}

/** The registry's language versions of a route, or `undefined` for a single-language page. */
export function routeLanguages(path: string): Record<string, string> | undefined {
  const versions = findRoute(path)?.alternates;
  return versions ? languageAlternates(path, versions) : undefined;
}
