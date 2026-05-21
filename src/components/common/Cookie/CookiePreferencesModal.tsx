// 📖 Docs: obsidian/frontend/components/common.md
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animated, useSpring, useTransition } from "@react-spring/web";

import { useScroll } from "@/hooks/smooth-scroll/use-scroll";

import { CookieButton } from "./CookieButton";
import { useCookieStore } from "./cookieStore";

type CategoryKey = "necessary" | "analytics" | "marketing";

interface Category {
  key: CategoryKey;
  title: string;
  body: string;
  required?: boolean;
}

const CATEGORIES: Category[] = [
  {
    key: "necessary",
    title: "Strictly necessary",
    body: "Required for the site to work — sign-in, security, page navigation. These can't be turned off.",
    required: true,
  },
  {
    key: "analytics",
    title: "Analytics",
    body: "Anonymised usage stats so we know which pages help and which fall flat. No personal profile is built.",
  },
  {
    key: "marketing",
    title: "Marketing",
    body: "Lets us measure ad performance and re-show content you didn't get to finish reading. Opt out anytime.",
  },
];

const TITLE_ID = "cookie-preferences-title";

export const CookiePreferencesModal = () => {
  const open = useCookieStore((s) => s.modalOpen);
  const consent = useCookieStore((s) => s.consent);
  const closeModal = useCookieStore((s) => s.closeModal);
  const acceptAll = useCookieStore((s) => s.acceptAll);
  const rejectAll = useCookieStore((s) => s.rejectAll);
  const savePreferences = useCookieStore((s) => s.savePreferences);

  const stopScroll = useScroll((s) => s.stop);
  const startScroll = useScroll((s) => s.start);

  // Pre-fill toggles as ON when no prior decision exists. Once a user has
  // saved a choice, that choice wins.
  const [analytics, setAnalytics] = useState<boolean>(consent?.analytics ?? true);
  const [marketing, setMarketing] = useState<boolean>(consent?.marketing ?? true);

  // Re-seed local toggles every time the modal opens so users see their saved
  // state, not whatever was in flight from a previous open.
  useEffect(() => {
    if (!open) return;
    setAnalytics(consent?.analytics ?? true);
    setMarketing(consent?.marketing ?? true);
  }, [open, consent]);

  // ESC closes; lock Lenis scroll while open; restore focus to the opener.
  const triggerRef = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    stopScroll();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      startScroll();
      const t = triggerRef.current as HTMLElement | null;
      if (t && typeof t.focus === "function") t.focus();
    };
  }, [open, closeModal, stopScroll, startScroll]);

  const handleSave = () => savePreferences({ analytics, marketing });

  // Spring-driven mount/unmount for backdrop + panel.
  const transitions = useTransition(open, {
    from: { opacity: 0, scale: 0.94 },
    enter: { opacity: 1, scale: 1 },
    leave: { opacity: 0, scale: 0.94 },
    config: { tension: 320, friction: 32 },
  });

  return transitions((style, isOpen) =>
    isOpen ? (
      <animated.div
        className="fixed inset-0 z-[100] font-sans"
        style={{ opacity: style.opacity }}
      >
        <div
          aria-hidden
          onMouseDown={closeModal}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <animated.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={TITLE_ID}
          style={{
            transform: style.scale.to((s) => `translate(-50%, -50%) scale(${s})`),
          }}
          className="absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-5 overflow-hidden rounded-xl border border-foreground/10 bg-background p-5 text-foreground shadow-2xl sm:p-7"
        >
          <header className="flex items-start justify-between gap-3">
            <h2 id={TITLE_ID} className="text-xl font-medium leading-tight">
              Cookie preferences
            </h2>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close cookie preferences"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 text-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <p className="text-sm leading-relaxed text-foreground/60">
            Choose which categories of cookies we&apos;re allowed to use. You can
            change this any time. See our{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              privacy policy
            </Link>
            .
          </p>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-1">
            {CATEGORIES.map((c) => {
              const value =
                c.key === "necessary"
                  ? true
                  : c.key === "analytics"
                    ? analytics
                    : marketing;
              const setValue =
                c.key === "analytics"
                  ? setAnalytics
                  : c.key === "marketing"
                    ? setMarketing
                    : undefined;
              return (
                <div
                  key={c.key}
                  className="flex items-start justify-between gap-4 rounded-[10px] border border-foreground/10 px-4 py-3.5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-sm font-medium leading-snug">{c.title}</h3>
                    <p className="text-xs leading-relaxed text-foreground/60">
                      {c.body}
                    </p>
                  </div>
                  <Toggle
                    on={value}
                    disabled={c.required}
                    label={c.title}
                    onChange={setValue ? () => setValue((v) => !v) : undefined}
                  />
                </div>
              );
            })}
          </div>

          <footer className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CookieButton variant="secondary" onClick={rejectAll}>
              Reject all
            </CookieButton>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <CookieButton variant="secondary" onClick={handleSave}>
                Save preferences
              </CookieButton>
              <CookieButton onClick={acceptAll}>Accept all</CookieButton>
            </div>
          </footer>
        </animated.div>
      </animated.div>
    ) : null,
  );
};

// ─── Toggle ──────────────────────────────────────────────────────────────────

interface ToggleProps {
  on: boolean;
  disabled?: boolean;
  onChange?: () => void;
  label: string;
}

const Toggle = ({ on, disabled, onChange, label }: ToggleProps) => {
  // Knob slides on a spring — track colour snaps (a state change, not motion).
  const knob = useSpring({ x: on ? 20 : 0, config: { tension: 320, friction: 26 } });

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
        on ? "bg-foreground" : "bg-foreground/15"
      } ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
    >
      <animated.span
        style={{ transform: knob.x.to((v) => `translateX(${v}px)`) }}
        className="absolute left-[3px] top-[3px] block h-[18px] w-[18px] rounded-full bg-background shadow"
      />
    </button>
  );
};
