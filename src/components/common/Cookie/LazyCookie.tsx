// 📖 Docs: obsidian/frontend/components/common.md
"use client";

/**
 * Lazy client wrapper for the Cookie banner + preferences modal.
 *
 * `dynamic({ ssr: false })` keeps the Cookie banner / preferences modal /
 * zustand store out of the page's first-load JS manifest. The chunk only
 * fetches when this wrapper actually mounts on the client — i.e. for real
 * users. Bots / lab UAs aren't rendered (gated upstream by the layout)
 * so they never load the chunk at all (~3.7 KB gz off the bot bundle).
 */

import dynamic from "next/dynamic";

const Cookie = dynamic(
  () => import("./Cookie").then((m) => ({ default: m.Cookie })),
  { ssr: false, loading: () => null },
);

export function LazyCookie() {
  return <Cookie />;
}
