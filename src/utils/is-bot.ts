import { headers } from "next/headers";

import { isBotUserAgent } from "@/utils/bot-ua";

/**
 * Whether the request comes from a crawler or a lab tool (Lighthouse, …).
 *
 * ⚠️ Reading `headers()` makes the calling route **dynamic** — rendered per
 * request, `cache-control: private, no-store`, no CDN cache — for every
 * visitor. Never `await isBot()` in a page, view or layout: the proxy already
 * routes robots to the robot form (`src/proxy.ts`, obsidian/frontend/robot-form.md).
 * Use this only in route handlers that are dynamic anyway.
 */
export const isBot = async (): Promise<boolean> => {
  const headersList = await headers();
  return isBotUserAgent(headersList.get("user-agent"));
};
