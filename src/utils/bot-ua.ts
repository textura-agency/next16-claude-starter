// 📖 Docs: obsidian/frontend/robot-form.md

/**
 * Crawlers, AI crawlers and lab tools, told apart by user agent — the one list
 * both the request proxy (`src/proxy.ts`, which has no `headers()`) and
 * `isBot()` read.
 *
 * Lighthouse and PageSpeed Insights identify themselves with "Lighthouse" in
 * the UA. The AI crawlers matter as much as the search engines: most of them
 * don't run JavaScript, so they read the served HTML and nothing else — the
 * robot form serves them the page at rest.
 */
export const BOT_UA =
  /lighthouse|pagespeed|googlebot|google-inspectiontool|bingbot|yandexbot|duckduckbot|baiduspider|applebot|headlesschrome|gtmetrix|pingdom|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|amazonbot|meta-externalagent|cohere-ai|mistralai-user|youbot|diffbot/i;

export const isBotUserAgent = (userAgent: string | null | undefined): boolean =>
  BOT_UA.test(userAgent ?? "");
