import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Generates `/manifest.webmanifest` from `siteConfig` — the brand's name and
 * colours, never a generic "App" (the old static `manifest.json` shipped that
 * name on every site cut from this starter). Next links it in `<head>`.
 *
 * The PNG icons in `public/` are placeholders: regenerate the whole set from
 * the brand's mark (obsidian/frontend/seo-metadata.md → "Brand kit").
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: siteConfig.backgroundColor,
    theme_color: siteConfig.themeColor,
    icons: [
      ...[36, 48, 72, 96, 144, 192].map((size) => ({
        src: `/android-icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
      })),
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
