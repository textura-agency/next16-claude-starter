// 📖 Docs: obsidian/frontend/components/common.md
"use client";

/**
 * Client wrapper for the Cookie banner + preferences modal.
 *
 * Not lazy, on purpose. It used to be `dynamic({ ssr: false })`, which kept
 * ~3.7 KB gz out of the first load but mounted the banner only after hydration
 * — and on a phone the banner's paragraph is the largest text on screen, so
 * LCP waited for the JS (the banner was the mobile LCP element on every site
 * measured). It is server-rendered now and paints with the page; returning
 * visitors and the robot form hide it in CSS before paint (`consent-flag.ts`,
 * `globals.css`).
 */

import { useLayoutEffect, useState } from "react";

import { isRobotView } from "@/components/common/robot-view";

import { Cookie } from "./Cookie";

export function LazyCookie() {
  // Robots get no consent banner: there is no visitor to ask. Decided in a
  // layout effect, after hydration — returning null on the first render would
  // not match the served banner (React #418) — from the server's marker,
  // because this layout renders before the page's robot module runs. Until
  // then `globals.css` keeps the served copy from painting.
  const [robot, setRobot] = useState(false);
  useLayoutEffect(() => {
    if (isRobotView()) setRobot(true);
  }, []);
  return robot ? null : <Cookie />;
}
