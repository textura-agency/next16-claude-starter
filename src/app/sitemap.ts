import type { MetadataRoute } from "next";

import { ROUTES, type SiteRoute } from "@/lib/routes";
import { siteConfig } from "@/lib/site";
import { languageAlternates } from "@/utils/seo/hreflang";

const absolute = (path: string) =>
  path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

/**
 * Generates `/sitemap.xml` from the route registry (`src/lib/routes.ts`) —
 * every indexable page, nothing else, with its language versions when it has
 * any. `<lastmod>` only where the registry
 * holds a real content date: the build time would move on every deploy, and
 * Google stops trusting a site's dates once they prove unreliable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return (ROUTES as readonly SiteRoute[])
    .filter((route) => route.indexable)
    .map((route) => ({
      url: absolute(route.path),
      ...(route.updated ? { lastModified: route.updated } : {}),
      ...(route.changeFrequency ? { changeFrequency: route.changeFrequency } : {}),
      ...(route.priority !== undefined ? { priority: route.priority } : {}),
      // Multi-language pages: every version, as absolute URLs (skill: i18n-seo).
      ...(route.alternates
        ? {
            alternates: {
              languages: Object.fromEntries(
                Object.entries(languageAlternates(route.path, route.alternates)).map(
                  ([code, path]) => [code, absolute(path)],
                ),
              ),
            },
          }
        : {}),
    }));
}
