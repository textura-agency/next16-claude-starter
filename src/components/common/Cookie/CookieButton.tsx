// 📖 Docs: obsidian/frontend/components/common.md
"use client";

import type { ReactNode } from "react";

/**
 * Cookie-scoped button primitive. Two variants matching the project's
 * white/dark surfaces — replaces the external `SimpleButton` the component
 * shipped with. Hover states snap (the project bans CSS transitions; real
 * motion goes through @react-spring/web).
 */
export interface CookieButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

const base =
  "rounded-lg px-4 py-2 text-sm font-medium leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

const variants: Record<NonNullable<CookieButtonProps["variant"]>, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary:
    "border border-foreground/15 bg-transparent text-foreground hover:bg-foreground/5",
};

export const CookieButton = ({
  children,
  onClick,
  variant = "primary",
}: CookieButtonProps) => (
  <button type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
    {children}
  </button>
);
