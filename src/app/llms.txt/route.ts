// 📖 Docs: obsidian/frontend/seo-metadata.md
/**
 * `/llms.txt` — a plain-markdown map of the site for language models
 * (llmstxt.org). Built from the route registry (`src/lib/routes.ts`) and
 * `siteConfig`, the same sources as `sitemap.xml` and the JSON-LD, so it can't
 * list a page the sitemap doesn't or state a fact the schema contradicts.
 * Prerendered at build time — nothing here reads the request.
 *
 * Facts, not marketing: a summary for a machine. The Payload kit
 * (`payload-cms`) replaces this file with one that reads the SEO global.
 */
import { ROUTES, type SiteRoute } from "@/lib/routes";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

export function GET(): Response {
  const { organization } = siteConfig;
  const absolute = (path: string) =>
    path === "/" ? siteConfig.url : `${siteConfig.url}${path}`;

  const pages = (ROUTES as readonly SiteRoute[])
    .filter((route) => route.indexable)
    // The home page's summary is the blockquote above — not repeated.
    .map(
      (route) =>
        `- [${route.label}](${absolute(route.path)})${route.summary ? `: ${route.summary}` : ""}`,
    );

  const address = organization.address;
  const facts = [
    organization.foundingDate && `- Founded: ${organization.foundingDate}`,
    address &&
      `- Location: ${[address.addressLocality, address.addressRegion, address.addressCountry]
        .filter(Boolean)
        .join(", ")}`,
    organization.email && `- Email: ${organization.email}`,
    organization.telephone && `- Telephone: ${organization.telephone}`,
    ...organization.sameAs.map((profile) => `- Profile: ${profile}`),
  ].filter((line): line is string => Boolean(line));

  const body = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "## Pages",
    "",
    ...pages,
    ...(facts.length > 0 ? ["", "## Key facts", "", ...facts] : []),
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
