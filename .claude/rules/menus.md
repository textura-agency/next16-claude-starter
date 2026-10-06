---
paths:
  - "src/**/*menu*"
  - "src/**/*Menu*"
  - "src/**/*nav*"
  - "src/**/*Nav*"
  - "src/**/*header*"
  - "src/**/*Header*"
  - "src/**/*drawer*"
  - "src/**/*modal*"
  - "src/**/*Modal*"
description: Full-screen overlays on phones — mobile menus, drawers, modals
---

# Mobile menus & full-screen overlays

Full note: `obsidian/frontend/mobile-menus.md`

- **Box:** `fixed top-0 inset-x-0 h-dvh` + `padding-bottom: env(safe-area-inset-bottom)`
  — never `inset-0 h-lvh` (its bottom hides under the iOS toolbar). Scroll
  inside the panel (`overflow-y-auto overscroll-contain`) when links can overflow.
- **Colour:** its own semantic token (`--menu-surface` / `--menu-foreground`),
  defined for dark mode too — check with dark mode emulated; a menu inheriting
  `--background` flips to black-on-black on a dark phone.
- **Portal under `<body>`** (`createPortal(…, document.body)`): inside a
  transformed / blurred / separately layered header, `position: fixed` is
  relative to the header and the overlay doesn't cover the screen. Create the
  portal inside the panel component — a portal returned straight from a
  `useTransition` callback remounts (focus lost ~1 s after opening).
- **Show, then focus:** render the panel visible in the same render that opens
  it, then move focus in (a hidden/`inert` panel can't take focus). Back to
  the toggle on close.
- **Behaviour:** scroll locked while open (`useScrollLock(open)`), Escape
  closes, a link click closes then scrolls, `aria-expanded` + `aria-controls`,
  `inert` when closed, reduced motion = a plain fade. Never remount a scene
  behind it.
- Springs only for its motion; on the robot form it rests closed
  (`robot-spring` handles `mode="always"` toggles).
