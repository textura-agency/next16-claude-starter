// 📖 Docs: obsidian/frontend/components/common.md
"use client";

import { useEffect } from "react";

import { CookieBanner } from "./CookieBanner";
import { CookiePreferencesModal } from "./CookiePreferencesModal";
import { useCookieStore } from "./cookieStore";

/**
 * Mount once at the root layout. Renders the bottom-right banner (until the
 * user has decided) and the preferences modal (when the user opens it).
 *
 * Hydration runs in a `useEffect` so the SSR pass and the first client render
 * agree on "not yet decided". The banner is in the server HTML from the start
 * (it paints with the page); a visitor who already chose never sees it — the
 * `data-consent` mark hides it before paint, and the store's read removes it.
 */
export const Cookie = () => {
  const hydrate = useCookieStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <CookieBanner />
      <CookiePreferencesModal />
    </>
  );
};
