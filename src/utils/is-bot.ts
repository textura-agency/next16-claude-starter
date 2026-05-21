import { headers } from "next/headers";

// Detect if the user agent is a bot (Lighthouse, Googlebot, etc.)
export const isBot = async (): Promise<boolean> => {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("lighthouse") ||
    ua.includes("googlebot") ||
    ua.includes("pagespeed") ||
    ua.includes("chrome-lighthouse") ||
    ua.includes("headlesschrome") ||
    ua.includes("gtmetrix") ||
    ua.includes("pingdom") ||
    ua.includes("bingbot") ||
    ua.includes("yandexbot")
  );
};
