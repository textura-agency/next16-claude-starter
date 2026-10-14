// 📖 Docs: obsidian/frontend/seo-metadata.md

import type { JsonLdNode } from "@/utils/seo/structured-data";

/**
 * Renders one JSON-LD document. A Server Component: the script is in the
 * served HTML, so crawlers that run no JavaScript read it, and both the
 * people and the robot form carry it. One per page (the root layout's
 * site graph aside) — compose nodes with `jsonLdGraph()` rather than adding
 * tags. `<` is escaped so copy can never close the script element early.
 */
export const JsonLd = ({ data }: { data: JsonLdNode }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    }}
  />
);
