/**
 * @fileoverview JSON-LD structured data helpers.
 *
 * Structured data lets search engines understand the site as entities
 * (Organization, WebSite) rather than just text — improving rich results.
 * Render the output inside a `<script type="application/ld+json">` tag.
 */

import { siteConfig } from "@/lib/site";

/** Overrides — a CMS's SEO global passes these; `siteConfig` fills the rest. */
export interface StructuredDataInput {
  /** The organisation's and the site's name — `og:site_name`'s twin. */
  name?: string;
  /** The legal name — the author/publisher the metadata carries. */
  legalName?: string;
  description?: string;
  /** The logo — a path under `public/` or an absolute URL. */
  logo?: string;
  /** The company's profiles elsewhere — `sameAs`. */
  sameAs?: readonly string[];
}

/** A path under `public/` becomes an absolute URL on the site's origin. */
const absolute = (url: string): string => (url.startsWith("/") ? `${siteConfig.url}${url}` : url);

/**
 * Organization + WebSite schema for the site root. Emit once, in the root
 * layout. The two nodes are linked by `@id` so crawlers treat them as related.
 */
export function getSiteStructuredData({
  name = siteConfig.name,
  legalName = siteConfig.author,
  description = siteConfig.description,
  logo = "/android-icon-192x192.png",
  sameAs = [],
}: StructuredDataInput = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name,
        ...(legalName && legalName !== name ? { legalName } : {}),
        url: siteConfig.url,
        logo: absolute(logo),
        ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        name,
        description,
        url: siteConfig.url,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };
}
