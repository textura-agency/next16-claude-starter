"use client";

// 📖 Docs: obsidian/frontend/robot-form.md

import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from "react";
import type React from "react";
import TextEngine from "spring-text-engine";

import { useRobot } from "./robot-view";

/**
 * spring-text-engine, except that on the robot form the text is plain
 * text in the same tag — the engine starts its letters hidden in the served
 * HTML. Swap a first-screen import:
 * `import { RobotText as TextEngine } from "@/components/common/robot-text"`.
 *
 * The identity transform keeps the engine's paint order: its letters are
 * transformed, which paints them in the positioned layer — above an overlay
 * (a legibility scrim) that plain in-flow text would sit under.
 */
const PAINT_AS_ENGINE = {
  transform: "translate(0)",
  // The engine lays each instance out as a wrapping flex row — so two inline
  // `<span>` engines stack as two lines (two-part headlines ran together
  // without this), and `justify-*` classes align.
  display: "flex",
  flexWrap: "wrap",
  // A flex row drops the whitespace between a text run and an inline child
  // ("Light, <Accent>written</Accent>" read "Light,written");
  // pre-wrap keeps it inside the text's anonymous item.
  whiteSpace: "pre-wrap",
} as const;

/**
 * The engine sets each line as a flex row, so a `justify-*` class aligns its
 * lines; on plain text that class does nothing. Carry it over as `text-align`
 * (a centred hero line rendered left-aligned without this) — unless the
 * author already aligns the text with a `text-*` class: an inline style would
 * beat its responsive variants (a `text-center lg:text-left` headline
 * rendered centred on desktop).
 */
const alignOf = (className = "") =>
  /(^|\s|:)text-(left|center|right|start|end|justify)(\s|$)/.test(className)
    ? undefined
    : /(^|\s)justify-center(\s|$)/.test(className)
      ? "center"
      : /(^|\s)justify-end(\s|$)/.test(className)
        ? "right"
        : undefined;

/**
 * How far below the viewport a `lazy` block may be before its engine mounts —
 * further than the engine's own in-view trigger, so the swap happens off
 * screen and the entrance plays as it always did.
 */
const LAZY_MARGIN = "150% 0px 150% 0px";

type RobotTextProps = ComponentProps<typeof TextEngine> & {
  /**
   * Below the fold: plain text until the block is within `LAZY_MARGIN` of the
   * viewport, then the engine. Every engine measures its lines at mount
   * (forced layouts), and a page of them hydrates in one long task (measured:
   * 18 engines, mobile TBT 2.6 s). Never on the first screen — the swap would
   * be visible there. Plain text is also what the served HTML holds, so the
   * copy is readable before hydration.
   */
  lazy?: boolean;
};

const Plain = ({ tag, className, mode, children, innerRef }: RobotTextProps & { innerRef?: React.Ref<HTMLElement> }) => {
  // Through `ComponentType`, not `ElementType`: with @react-three/fiber's JSX
  // augmentation a dynamic intrinsic tag types its children as `never` and a
  // project that type-checks its build fails on it.
  const Tag = (tag ?? "div") as unknown as ComponentType<Record<string, unknown>>;
  return (
    <Tag
      ref={innerRef}
      className={className}
      style={{
        ...PAINT_AS_ENGINE,
        textAlign: alignOf(className),
        // At rest a scroll-scrubbed line (`mode="progress"`) is at progress 0 —
        // the engine's out-state, hidden. Showing it stacked a whole
        // hero sequence on the first screen. (The text is still in the DOM.)
        visibility: mode === "progress" ? "hidden" : undefined,
      }}
    >
      {children}
    </Tag>
  );
};

/** Mounts the engine once the plain block nears the viewport. */
const LazyEngine = (props: RobotTextProps) => {
  const { lazy: _lazy, ...engine } = props;
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); },
      { rootMargin: LAZY_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  if (near) return <TextEngine {...engine} />;
  return <Plain {...props} innerRef={ref} />;
};

export const RobotText = (props: RobotTextProps) => {
  const robot = useRobot();
  if (robot) return <Plain {...props} />;
  if (props.lazy) return <LazyEngine {...props} />;
  const { lazy: _lazy, ...engine } = props;
  return <TextEngine {...engine} />;
};
