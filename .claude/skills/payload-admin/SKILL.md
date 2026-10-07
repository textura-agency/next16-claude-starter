---
name: payload-admin
description: Make a Payload admin feel like part of the site and explain itself — the skin re-tinted from the site's own tokens (calm, light, no added motion), the site's wordmark and favicon, a dashboard welcome card, sidebar groups in reading order, rows named by their own copy, field notes in the editor's words, and an editor's guide inside the admin (/admin/guide) with a screenshot of every screen beside the entry that edits it, plus SEO and Analytics explained. Use after `payload-cms` is in, or when the user says the admin "looks bad", "hurts the eyes", "everything merges", "make it in the site's style", "add documentation / a guide / hints in the admin", "the client won't understand the admin".
---

# The admin's look and its guide

An owner judges the CMS in the first minute: does it look like *their* site,
and can they find the hero? This skill is how the reference site's admin went
from "it hurts the eyes, everything merges" to a quiet, branded tool with its
own manual. Kits: `admin` and `guide` (`bash .claude/skills/payload-cms/scaffold.sh admin guide`).

## Principles (each was a correction from the owner)

1. **Light only** (`admin.theme: "light"`). One theme done well beats two half-done.
2. **Calm, not loud.** The first skin was bold and "hurt the eyes"; the one that
   stuck: pale ground, one white panel per screen, 13px muted labels, headings
   that step down by **size not weight**, the accent only on what can be pressed.
3. **Nothing merges.** Every tab a bordered pill, nested groups as soft panels
   with small headings (not a second big title on a vertical rule), array rows
   in one rounded clipped frame (Payload's own 4px corners otherwise show through).
4. **Hover = colour only.** No fills, underlines or shadows; **no transitions or
   animation added** (starter motion rules). Payload's own are kept.
5. **The site's marks**: wordmark on the login card, favicon in the nav.
6. **The sidebar is the site**: *Home page* (numbered, scroll order) → *Site* →
   *Pages & documents* → *Insights* → *Help* → *Settings* last.
7. **The editor's words everywhere**: labels by what the reader sees
   ("Accent (highlighted part)"), a one-line note per global with the rule that
   matters before Save, row labels from the row's own copy ("03 · Design & ID").

## §Skin — `src/app/(payload)/custom.css`

1. Fill the **Tier 1 block** at the top (`--admin-surface/ground/field/line/
   navy/ink/muted/accent/accent-strong/accent-deep/good/bad/live`) from the
   site's `--raw-*` values in `globals.css`. Those are the only raw colours in
   the file; Payload's whole `--color-base-*` ramp and `--color-success-*` are
   mixed from them (`color-mix`, oklab). `--admin-ground` is a *paler* tint of
   the site's ground — the site's own ground is usually too strong for a
   full-screen form.
2. Fonts: add `@font-face` blocks for the site's self-hosted files (family "Site Sans") — a `url()` that doesn't resolve fails the build, so the kit ships none and falls back to the system stack.
3. Unlayered rules beat Payload's `@layer` — no `!important` needed.
4. Settings (users, media) is Payload's **first** group because collections list
   before globals; the skin moves it last with flex `order`. Keep that block.
5. Check contrast: `--admin-muted` on `--admin-surface` ≥ 4.5:1.

Selector map and what each block targets: `references/skin-map.md`.

## §Marks, welcome, rows

- `graphics.tsx` — import the wordmark's SVG path from the site's component
  (export it once; never a second copy). Falls back to the brand name as text.
- `welcome.tsx` — above the dashboard: what this admin is for, "Open the site ↗",
  "Read the guide". Say what stays in code.
- `row-label.tsx` — `NAME_KEYS` (`title`, `name`, `label`, `text`, `lead`…):
  extend with the keys this project's cards use for their name.
- `payload.config.ts`: `meta.titleSuffix: " — <Brand> Content"`, the favicon,
  `i18n` English only (unless the owner asks otherwise — ask once).

## §Guide — `/admin/guide`

The editor's documentation, **inside** the admin, read-only, no client code.
Build it **last**: it documents the final sidebar.

1. `guide-content.tsx` — plain data:
   - `INTRO`: how the admin works (sidebar = site; Save shows at once; blank is
     safe; what stays in code; no version history — retype to undo).
   - `CHAPTERS`: one entry per sidebar item, in sidebar order —
     `where` (the sidebar path), `title` (what they see), `shot`,
     `fields` (what changes, in the screen's words), `notes` (rules: a count the
     layout needs, links set in code, `{name}` placeholders, "keep it short — it
     paints with the first screen").
   - `SEO` (tab by tab, field by field, where each shows), `ANALYTICS` (number
     by number, how a visitor is counted, what is not stored), `SETTINGS`.
2. **Screenshots** — the site's own screens, one per entry:
   ```bash
   yarn build && yarn start -p 4500
   node tools/qa/admin-shots.mjs --url http://localhost:4500/ \
     --shots "hero=#hero,header=header,footer=footer,not-found=/404" --save public/admin-guide
   ```
   1440 × 900, a person's UA (not the robot form), cookie banner and dev
   overlays hidden, each section scrolled into view and settled, 1200 px WebP
   (~40 KB). **Look at every shot.** Re-shoot when a screen changes — the guide
   shows whatever is in the folder.
3. `guide-body.tsx` imports nothing of Payload's, so it can be rendered alone
   (that's how it is checked — Payload's template needs a signed-in user).
   `guide-view.tsx` wraps it in `DefaultTemplate`; `guide-nav.tsx` adds *Help →
   Guide* to the nav. `yarn generate:importmap` after adding them.
4. `next/image` serves the WebPs — the admin pays for thumbnails.

## Prove it

- `/admin/login`, dashboard, a global with arrays + tabs (SEO), Media, Analytics,
  Guide — at 1440 and at 390 wide. Screenshot each and look.
- Nothing merges: every tab, group and row has a visible edge.
- Keyboard: focus ring visible (`--accessibility-outline` → accent).
- `yarn lint`, `yarn build`.
- After a Payload upgrade: the same tour — class names are not a public API.
