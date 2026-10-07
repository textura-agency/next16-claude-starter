/**
 * @fileoverview Standardised metadata + viewport generators for pages.
 * 📖 Docs: obsidian/frontend/seo-metadata.md
 *
 * `generateMetadata` builds a Next.js `Metadata` object — title (with the
 * site-wide template), description, keywords, OpenGraph, Twitter cards,
 * canonical URL, icons, robots. `metadataBase` is always set (from
 * `siteConfig`) so relative URLs (OG image, canonical) resolve to absolute —
 * required by social scrapers.
 *
 * `generateViewport` builds the `Viewport` export. `themeColor` lives here, not
 * in `Metadata` — Next deprecated it on the metadata object.
 */

import { Metadata, Viewport } from "next";

import { siteConfig } from "@/lib/site";

interface MetadataProps {
  /**
   * The page's own title. Omitted → the home title (`siteConfig.title`).
   * Given → rendered through the template as `<title> · <brand>`.
   */
  title?: string;
  description?: string;
  /** Canonical path (e.g. `/about`) or absolute URL for this page. */
  url?: string;
  /** Open Graph / Twitter image — path under `public/` or absolute URL, 1200×630. */
  ogImage?: string;
  ogImageAlt?: string;
  keywords?: string[];
  twitterHandle?: string;
  author?: string;
  siteName?: string;
  /**
   * The title is the whole `<title>` — not run through `· <brand>`. Set by
   * the CMS (`cms/content.ts`): an editor writes, and the SEO plugin counts,
   * exactly what a search result shows.
   */
  absoluteTitle?: boolean;
  /** The share image's real size — an uploaded image passes its own. */
  ogImageSize?: { width: number; height: number };
  /** Keep the page out of search results (the 404, or an editor's choice). */
  noIndex?: boolean;
  /** `og:locale` — `language_REGION`. */
  locale?: string;
}

export function generateMetadata({
  title,
  description = siteConfig.description,
  url = "/",
  ogImage = siteConfig.ogImage,
  ogImageAlt = siteConfig.ogImageAlt,
  keywords = siteConfig.keywords,
  twitterHandle = siteConfig.twitterHandle,
  author = siteConfig.author,
  siteName = siteConfig.name,
  absoluteTitle = false,
  ogImageSize = { width: 1200, height: 630 },
  noIndex = false,
  locale = siteConfig.locale,
}: MetadataProps = {}): Metadata {
  // The `<title>`: the home title as is, a page title through the template
  // (or as given, when the CMS wrote the whole of it).
  const fullTitle = title ? (absoluteTitle ? title : `${title} · ${siteName}`) : siteConfig.title;
  const image = { url: ogImage, ...ogImageSize, alt: ogImageAlt };

  return {
    // Resolves every relative URL below to an absolute one.
    metadataBase: new URL(siteConfig.url),
    title: title
      ? { absolute: fullTitle }
      : { default: siteConfig.title, template: `%s · ${siteName}` },
    description,
    applicationName: siteName,
    ...(keywords.length > 0 ? { keywords } : {}),
    authors: [{ name: author }],
    creator: author,
    publisher: author,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      // The image must really be 1200×630 — scrapers crop or letterbox a
      // mismatch. Replace the placeholder in public/.
      images: [image],
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      // No handle → no tags. An invented handle tags a stranger.
      ...(twitterHandle ? { site: twitterHandle, creator: twitterHandle } : {}),
      images: [image],
    },
    // `icon.svg` first: modern browsers take the vector. There is deliberately
    // no `src/app/favicon.ico` — Next links that file convention ahead of these
    // and it wins `/favicon.ico`; the ICO lives in `public/` instead.
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [
        { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
      ],
    },
    // `src/app/manifest.ts` is linked automatically.
    robots: {
      index: !noIndex,
      follow: true,
    },
  };
}

export function generateViewport(): Viewport {
  return {
    themeColor: siteConfig.themeColor,
    width: "device-width",
    initialScale: 1,
  };
}
