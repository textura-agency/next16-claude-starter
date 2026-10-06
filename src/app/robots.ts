import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Generates `/robots.txt`. Allows all crawlers and points them at the sitemap.
 * Tighten the rules per environment (e.g. disallow `/` on staging).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The robot form of `/` is served under `/` by the proxy (`src/proxy.ts`);
      // its own path is a duplicate and stays out of the index. robots.txt is
      // evaluated on the requested URL, so `/` is still crawled.
      disallow: "/robot-view",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
