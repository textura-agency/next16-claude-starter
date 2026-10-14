import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * AI crawlers by what they do with a page — the user agents each vendor
 * documents. `siteConfig.aiCrawlers` decides each purpose; a new crawler goes
 * in its group here and, when it reads pages to answer people, in
 * `src/utils/bot-ua.ts` too.
 */
const AI_CRAWLERS = {
  search: ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"],
  userFetch: ["ChatGPT-User", "Claude-User", "Perplexity-User"],
  training: [
    "GPTBot",
    "ClaudeBot",
    "CCBot",
    "Google-Extended",
    "Applebot-Extended",
    "Meta-ExternalAgent",
    "Bytespider",
  ],
} as const;

/**
 * The robot form of `/` is served under `/` by the proxy (`src/proxy.ts`); its
 * own path is a duplicate and stays out of the index. robots.txt is evaluated
 * on the requested URL, so `/` is still crawled.
 */
const NEVER_CRAWLED = ["/robot-view"];

/**
 * Generates `/robots.txt`: everyone may crawl the site except the duplicate
 * path, and every AI crawler gets a named group stating the site's policy for
 * its purpose — an explicit stance rather than one inferred from `*`. A named
 * group replaces `*` for that crawler, so each one repeats the disallow list.
 * Tighten per environment (e.g. disallow `/` on staging).
 */
export default function robots(): MetadataRoute.Robots {
  const aiRules = (Object.keys(AI_CRAWLERS) as (keyof typeof AI_CRAWLERS)[]).map(
    (purpose) =>
      siteConfig.aiCrawlers[purpose]
        ? {
            userAgent: [...AI_CRAWLERS[purpose]],
            allow: "/",
            disallow: NEVER_CRAWLED,
          }
        : { userAgent: [...AI_CRAWLERS[purpose]], disallow: "/" },
  );

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: NEVER_CRAWLED }, ...aiRules],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
