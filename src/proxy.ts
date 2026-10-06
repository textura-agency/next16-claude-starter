// 📖 Docs: obsidian/frontend/robot-form.md

import { NextResponse, type NextRequest } from "next/server";

import { isBotUserAgent } from "@/utils/bot-ua";

/**
 * Robots get the home page at rest.
 *
 * A crawler, an AI crawler or a lab tool (Lighthouse, PageSpeed) asking for `/`
 * is rewritten to `/robot-view`: the same view, content, metadata and
 * canonical — without the intro and the motion a robot never watches, and
 * with every line of copy in the served HTML. Both routes stay static: the UA
 * is read here, not with `headers()` in the page, so the human `/` stays
 * prerendered and CDN-cached. A person who types `/robot-view` is sent to `/`.
 *
 * Add other animated routes the same way (`/about` → `/robot-view/about`) if
 * the project grows them.
 */
export function proxy(request: NextRequest) {
  const bot = isBotUserAgent(request.headers.get("user-agent"));
  const { pathname } = request.nextUrl;
  if (pathname === "/" && bot) {
    return NextResponse.rewrite(new URL("/robot-view", request.url));
  }
  if (pathname === "/robot-view" && !bot) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/robot-view"],
};
