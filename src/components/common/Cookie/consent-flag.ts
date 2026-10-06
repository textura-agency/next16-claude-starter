// 📖 Docs: obsidian/frontend/components/common.md

/** localStorage key holding the visitor's cookie choice. */
export const CONSENT_STORAGE_KEY = "cookie-consent-v1";

/**
 * The banner is server-rendered, so it paints with the page instead of after
 * hydration — on a phone its paragraph is the largest text on screen, i.e. the
 * LCP element, and a client-only banner made LCP wait for the JS (measured on
 * production sites: mobile LCP 11.0 → 2.3 s, perf 53 → 74).
 *
 * This runs before the banner is parsed — first child of <body> — and marks
 * <html data-consent> for a visitor who has already decided; `globals.css`
 * hides the banner under that mark before its first paint, so a returning
 * visitor never sees it flash.
 *
 * No "use client": the server layout imports the string itself, not a client
 * reference.
 */
export const CONSENT_FLAG_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  CONSENT_STORAGE_KEY,
)}))document.documentElement.setAttribute("data-consent","")}catch(e){}`;
