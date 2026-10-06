---
tags: [frontend, mobile, a11y, stable]
updated: 2026-10-06
---

# Mobile menus & full-screen overlays

The starter ships no menu — every site's is its own design. These are the
defects full-screen menus shipped with on real phones, and the pattern that
fixed them (real-iPhone reviews, several sites). Rules bind in
`.claude/rules/menus.md`.

## The box

```tsx
<div
  id="mobile-menu"
  className="fixed inset-x-0 top-0 z-[100] flex h-dvh flex-col overflow-y-auto overscroll-contain bg-menu-surface text-menu-foreground pb-[env(safe-area-inset-bottom)]"
  inert={!open}
>
```

- `top-0 h-dvh` + the bottom safe area — **not** `inset-0 h-lvh`: the large
  viewport's bottom sits under the iOS toolbar, and the CTA / socials at the
  bottom of the menu were cut off. (`lvh` is right for a *scene* box — see
  [[webgl-scenes]] — and wrong for anything with UI at its bottom.)
- Scroll inside the panel when the links can outgrow a short phone.
- After any phone layout change: `scrollWidth === innerWidth` at 360–430 px.

## Its own colour token, dark mode included

Give the menu its own Tier-2 tokens (`--menu-surface`, `--menu-foreground`,
bound as `--color-menu-surface` etc. — [[design-system]]) and define them in
the dark-mode block too. A menu that borrowed `--background` / `--foreground`
flipped to dark-on-dark on a phone in dark mode — and reviewers' phones often are.
Check with dark mode emulated (`prefers-color-scheme: dark`).

## Portal under `<body>`

`position: fixed` is relative to the nearest ancestor with a `transform`,
`filter`, `backdrop-filter` or `will-change` — a glass header is all of those.
Inside it the "full-screen" overlay covers only the header. Render the overlay
with `createPortal(panel, document.body)`.

- Create the portal **inside the panel component**. A portal returned straight
  from a react-spring `useTransition` callback remounts ~1 s after opening —
  focus is lost.
- **Show, then focus:** make the panel visible (not `inert`, not
  `visibility: hidden`) in the same render that opens it, then move focus to
  its first link. Focus can't move into a hidden panel; trying it in the click
  handler leaves focus on the toggle.

## Behaviour

- Scroll locked while open: `useScrollLock(open)` (`src/hooks/use-scroll-lock.ts`)
  — stops Lenis and native scroll together; `body { overflow: hidden }` alone
  does not stop Lenis.
- Escape closes; a link click closes, then scrolls to its target.
- The toggle: `aria-expanded`, `aria-controls="mobile-menu"`, a name that says
  what it does; focus returns to it on close.
- Closed: `inert` (out of the tab order and the accessibility tree — A11y must
  stay 100).
- Motion with springs only: the panel enters by clip-path / scale / translate,
  links stagger ~40–60 ms, the exit is the reverse and faster. Reduced motion
  = a plain fade. On the robot form the menu rests closed (`robot-spring`
  treats `mode="always"` + `enabled={open}` as a toggle).
- Keep a scene behind it running or paused — never remount it.
- Before redesigning a menu, find which component is actually mounted — a site
  carried an unused full-screen menu next to the live dropdown.

## Verify

Mobile viewport (390×844), light and dark: closed, mid-animation, open at rest,
closed again — screenshots, looked at. Tab through it open; axe on the open
state.

## Related

[[webgl-scenes]] · [[smooth-scroll]] · [[design-system]] · [[html-semantics]]
