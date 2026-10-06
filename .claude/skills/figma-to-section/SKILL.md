---
name: figma-to-section
description: Turn a Figma frame or node into components in this starter — the MCP call order, recording node IDs so later passes can re-fetch, downloading and verifying assets, mapping design values onto the three-tier token system, and choosing spring primitives for whatever motion the design implies. Use when the user provides a Figma URL, says "build this section", "implement the design", "match the Figma", or hands over a frame to code up.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
---

# Figma → section

Build from **live Figma data**, never from a text description, a summary you
wrote earlier, or memory. Descriptions lose exactly the values that matter.

## 1. Extract, in this order

1. `get_metadata` — file structure, pages, top-level frames. Gives you the
   `fileKey` and the node IDs.
2. `get_design_context` on the target node — exact text, colours, typography,
   spacing, layout, asset URLs. **This is the source of truth for values.**
3. `get_screenshot` on the same node — **the source of truth for layout**:
   column count, direction, alignment, order, positioning.

Both. `get_design_context` will not tell you a layout reads as three columns;
the screenshot will not tell you the gap is 28px.

## 2. Record what you fetched

Write `DESIGN-MAP.md` at the repo root (gitignored or committed, user's call):

```markdown
**Figma file key:** `<fileKey>`
**Source URL:** <url>
**Frame width:** <px>   ← the design base width; check it against the adaptive grid

| Section | Node ID | View / component | Background | Notes |
|---------|---------|------------------|------------|-------|
| Hero    | `1:234` | views/home → Hero | full-bleed image | h1 lives here |
```

Every section needs its node ID. QA and any later pass re-fetch from these — a
section without a node ID cannot be verified against its design later.

## 3. Assets

`get_design_context` returns asset URLs that **expire** (~7 days). Download
immediately.

- Save to `public/assets/<section>/` — one folder per section
  (`obsidian/architecture/folder-structure.md`). Meta/PWA assets stay at
  `public/` root.
- kebab-case, prefixed by section: `hero-background.webp`, `team-jane-doe.webp`,
  `icon-arrow.svg`.
- **Verify each file after download**: run `file <path>`. Figma often returns an
  SVG where you asked for a raster, or a PNG named `.jpg`. Rename to match the
  real type — a mismatched extension renders as a broken image.
- **Sanity-check size**: a content photo under ~5KB is almost certainly a vector
  placeholder, not the intended export. Flag it; do not ship it.
- Prefer `.webp`/`.avif` for photos. `next/image` with explicit `width`/`height`.
- If a download fails: use a placeholder, add a comment saying why, and **tell
  the user immediately** — never silently skip an asset.

## 4. Values → tokens (do not skip to markup)

Before writing JSX, map the design's values onto the token system
(`obsidian/frontend/design-system.md`):

- Every colour becomes a `--raw-*` primitive plus a **semantic** Tier 2 token
  naming its purpose. `--raw-color-brand-500` + `--action-primary`, never
  `--blue-500` used directly in markup.
- Spacing/radius/type values: reuse an existing token if one matches; otherwise
  add one, with a comment naming the Figma frame it came from.
- A value you cannot justify as a token is a **design-review flag** for your
  summary, not a magic number in a class name.
- This project scales the root font-size with the viewport, so design px map to
  `rem` cleanly at the design base width. Check the frame width against the
  breakpoints in `globals.css` before converting anything.

## 5. Build

Follow `obsidian/workflows/new-page.md`. Specific to design work:

- **Copy is character-for-character** from `get_design_context`. Never rewrite,
  shorten or invent — even if the design's copy reads badly. Flag it instead.
- **Do not invent visual features.** No shadows, gradients, overlays, hovers or
  card wrappers that are not in the design. An invented wrapper background is the
  single most common cause of "the logo disappeared".
- **Do add the motion this starter is for** — that is the one place we
  deliberately go beyond a static Figma frame. Reveals, parallax and text
  animation are the house style; use `Inview` / `SpringTrigger` / the text engine
  and keep it restrained. If the user wants a literal static translation, they
  will say so.
- Content comes in as props (mocks under `src/data/mocks/<page>.ts` until real
  data or the CMS exists) — never hardcoded in the component.
- Semantic markup and the correct `tag` on every animation component.
- **First-screen sections use the robot twins** (`robot-spring`, `robot-text`,
  `robot-inview`, `robot-hover` in `src/components/common/`) so crawlers get the
  copy at rest; below-fold text engines take `lazy`; every `loop:` reads
  `useMotionOff()` (`optimize-load/references/robot-path.md`).
- **Phone frames are layouts, not coordinates.** Build the phone design in flow
  (flex/grid, a page gutter token) — absolutely positioning every element from a
  390-wide frame made a later "1rem side padding" request a 30-file change on a
  production site. Split-letter headlines group letters per word
  (`white-space: nowrap`) so they never break mid-word; check
  `scrollWidth === innerWidth` at 320–430. Scene boxes are `lvh`, menus `dvh` +
  safe area (`mobile-device-qa`).

## 6. Finish

Run the `qa-verify` skill against the section before reporting done, and report:
new tokens added and why, values that could not map to tokens, any asset that
failed or looked wrong, and any copy you flagged rather than changed.
