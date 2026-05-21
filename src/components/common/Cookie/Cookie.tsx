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
 * agree on "not yet decided" — the banner only appears after the localStorage
 * read on the second client render.
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
