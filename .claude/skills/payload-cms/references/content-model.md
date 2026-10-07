# The content model — derived, merged, fallback-safe

Code: `templates/core/src/cms/text-schema.ts.tmpl` (the walk and the merge),
`globals.ts.tmpl` (the list), `content.ts.tmpl` (the reads).

## Where content lives, by what it is

| The thing | Payload shape | Why |
|---|---|---|
| A section of a page, exists once (hero, features, footer) | **global** derived from its mock | Nothing to list or create; sidebar reads like the page |
| Site chrome (header, footer, forms, cookie banner, emails, 404) | **global** in group *Site* / *Pages & documents* | Same |
| A document (privacy, terms) | **global** with sections + rich text (legal kit) | Sections are the content — add/remove/reorder |
| Things that are many and grow (posts, cases, jobs) | **collection** with hand-written fields + slug | They have their own routes; derivation doesn't apply |
| Pages an editor composes from parts | **blocks** — only then | A choreographed marketing page is NOT this: its order is tied to motion |

If unsure, it is a global.

## How the walk turns a value into a field

| Value in the mock | Field | Editor can |
|---|---|---|
| string ≤ 70 chars | `text`, default = the copy | rewrite |
| string > 70 chars | `textarea` | rewrite |
| image object's `src` | optional `upload` → Media, **no default** | replace the photo; blank = code's photo |
| list of strings | array of `{ text }` | add / trim / reorder |
| list of strings named in `FIXED_LISTS` | same, `minRows = maxRows = count` | rewrite lines only (a headline split into lines) |
| object | collapsible `group` | — |
| list of objects | array, **fixed rows**, hidden `key` = item `id` | rewrite each card |
| list of objects in `OPEN_LISTS` | same rows, `min..max` | drop, reorder, add (new row must fill every line + photo) |
| key in `SKIP`, numbers, booleans | nothing | — (stays in code) |

A field only some items have (one card has chips, another a figure) is shown
on those rows only (`admin.condition` by `key`).

## Rules for the mocks (so derivation works)

- **Every list of cards has a string `id`** — that is what ties a saved row to its
  item. Without ids rows match by index, and reordering in code cross-wires copy.
- **Copy and wiring in one object is fine** — that is what `SKIP` is for. But name
  wiring consistently (`href`, `anchor`, `icon`, `tone`…) so `SKIP` stays short.
- **A sentence around a link** travels as `before` / `link` / `after`; the href
  stays in code.
- **Split headlines** (`lead` + `accent`) are two fields — label them by colour
  ("Accent (highlighted part)").
- **Decorative images** keep `alt: ""` — the merge keeps them decorative.
- **No copy in components.** A string in JSX is invisible to the admin.

## The merge (`mergeText(base, patch)`)

- Strings replaced only by non-blank strings. Unknown keys ignored.
- String lists: blank rows dropped; all blank → the code's list.
- Fixed card lists: matched by `key`, else by index; each item merged recursively.
- Open lists: the editor's rows in their order; a row tied to an item = that item
  merged; an added row = the first item's shape + their copy, kept only if
  complete; fewer usable rows than `min` → the code's list.
- Photos: upload URL → `src`; `small` (512 px WebP) → `texture` where the object
  has one; the upload's alt replaces the code's alt only if the editor didn't
  rewrite it; `crop` dropped (it was tuned to the old photo).
- Returns **the code's type** — views don't change.

## Adding copy later

1. Add the string to the mock (and render it).
2. `yarn generate:types` → `yarn migrate:direct create <name>` → `yarn migrate:direct`.
3. It appears in the admin defaulted to the new copy; the site serves the code's
   copy until someone saves.

A global never saved has no row — the site reads the code. That is why a seeded
open list (say a logo strip that gained a floor of 4) may need the migration to
**insert** the code's rows into an already-saved global, or it opens empty
below its floor.

## Sweeping for missed copy (do it twice: before install, before handover)

```bash
grep -rnE '>[A-Z][a-z]+[^<{]{8,}<' src/views src/components | grep -v aria-   # literal JSX text
grep -rn '"[A-Z][a-z].\{15,\}"' src/components src/lib | grep -v mocks         # string props / server copy
```

Common misses: form validation messages ("X is required." composed in code —
make it one `error` per field), toasts, the cookie banner and its dialog, the
phone menu's extras, legal-page labels ("Last updated", "Back to top"), email
subjects and bodies in `src/lib/email/`, the 404.
