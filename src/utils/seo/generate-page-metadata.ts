/**
 * @fileoverview Utility function to generate standardized metadata for pages
 *
 * This function generates metadata for Next.js pages including:
 * 1. Basic meta tags (title, description, keywords)
 * 2. OpenGraph metadata for social sharing
 * 3. Twitter card metadata
 * 4. Canonical URL and alternates
 * 5. Author and publisher information
 *
 * @param {MetadataProps} props - Configuration object containing:
 *   - title: Page title
 *   - description: Page description
 *   - keywords: Meta keywords
 *   - url: Canonical URL
 *   - ogImage: OpenGraph image URL
 *   - twitterHandle: Twitter username
 *   - author: Content author
 *   - themeColor: Theme color
 *   - siteName: Site name
 *
 * @returns {Metadata} Next.js Metadata object with configured meta tags
 */

import { Metadata } from "next";

interface MetadataProps {
  title?: string;
  description?: string;
  keywords?: string;
  url?: string;
  ogImage?: string;
  twitterHandle?: string;
  author?: string;
  themeColor?: string;
  siteName?: string;
}

export function generateMetadata({
  title = "New Project",
  description = "New Project",
  keywords = "New Project",
  url = "",
  ogImage = "/open-graph.png",
  twitterHandle = "@newproject",
  author = "New Project",
  themeColor = "#000",
  siteName = "New Project",
}: MetadataProps): Metadata {
  return {
    title,
    description,
    keywords,
    authors: [{ name: author }],
    creator: author,
    publisher: author,
    themeColor,
    metadataBase: url ? new URL(url) : null,
    alternates: {
      canonical: url || undefined,
    },
    openGraph: {
      title,
      description,
      url: url || undefined,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1080,
          height: 720,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: twitterHandle,
      creator: twitterHandle,
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [
        { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/manifest.json",
    robots: {
      index: true,
      follow: true,
    },
    other: {
      distribution: "web",
      language: "english",
    },
  };
}
