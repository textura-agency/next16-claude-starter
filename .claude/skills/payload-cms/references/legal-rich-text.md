# Legal pages as rich text (D15)

Code (adapt, don't copy): `templates/legal/` — `cms/legal.ts` (fields +
`fromLegal`), `cms/legal-rich-text.ts` (`toRichText`, types),
`views/legal/legal-rich-text.tsx` (server renderer).

## Why rich text from day one

The reference site first modelled each section as Payload blocks (paragraph /
list / table). The owner then asked to bold a word and put a link inside a
sentence — impossible in that model — and a migration dropped 24 tables to
replace them. Start with one Lexical `body` per section.

## Shape

A legal global per document (group *Pages & documents*):
`title`, `intro`, `sections[]` → `{ title, short?, anchor?, summary?, body }`.

`body` editor features — only what a policy needs:
Paragraph, Bold, Italic, Underline, Strikethrough, Link (addresses only:
`https://`, `mailto:`, `/path` — no internal doc links), ordered/unordered list,
**h3 only** (the page owns h1, the section h2), Fixed + Inline toolbar, and
`BlocksFeature` for anything that isn't text (a table, the cookie-settings
button). No uploads.

`anchor` = the `id` the contents rail links to; written from the title when blank.

## The code's copy stays readable

Keep the mock in its readable form; `toRichText(mock)` builds the Lexical state
for the admin's **defaults** and the site's **fallback**, so both are the same
text. Conventions that convert well: a list item `Lead — rest` → bold lead; a
paragraph's trailing link → a link node. Block ids must be stable (seeded) so
defaults don't churn.

The starter's mock is `{ heading, body: string[] }` — paragraphs only: map
`heading → title`, each string → a paragraph node.

## Rendering

`RichText` from `@payloadcms/richtext-lexical/react` (server component) with
`JSXConvertersFunction` overrides so every node is the element the page already
styled: bold in the ink colour, the site's link component, its bullets, the
framed table (scrolls in its own box on a phone), the cookie-preferences button.
Never `dangerouslySetInnerHTML`. Nothing animates — a policy is read.

## Reading

`getLegal(slug)` = `fromLegal(base, await readGlobal(slug))`: field-by-field
fallback, wholesale fallback when nothing was saved; a section's body falls back
only if the saved state is empty (`asRichText`). Add the slugs to
`PAGE_GLOBALS` in `content.ts` (sitemap `lastmod`) and the globals to
`globals.ts` after `TEXT_GLOBALS`. Labels around the documents ("Last updated",
"Back to top", the document switch) are a separate text global, *Legal pages —
labels*.
