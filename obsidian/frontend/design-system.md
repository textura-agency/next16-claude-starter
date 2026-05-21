---
tags: [frontend, design-system, stable]
updated: 2026-05-21
---

# Design System — Tailwind v4

Styling uses **Tailwind CSS v4**, configured entirely in CSS. There is **no
`tailwind.config.js`**. ADR: [[decisions-log]] ADR-0004.

## Where config lives

`src/app/globals.css` is the single config file:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-onest);
}
```

Extra CSS layers can be split into `src/style/index.css` and imported.

## Design tokens

All colours, spacing, font sizes, radii, and shadows are **tokens** declared under
`:root` (raw values) and `@theme inline` (Tailwind bindings).

Once a token is in `@theme`, it becomes a utility automatically:

| Token | Generated utilities |
|-------|--------------------|
| `--color-brand` | `bg-brand`, `text-brand`, `border-brand` |
| `--radius-card` | `rounded-card` |
| `--spacing-section` | `pt-section`, `mt-section`, … |

> [!important] The token rule
> **Never** hardcode hex values, pixel spacing, or named colours in `className` or
> inline styles. If a value doesn't exist as a token, **add it to `globals.css`
> first** — with a comment noting where it came from (e.g. a Figma frame).

## CSS layers

Every custom style goes inside a layer — never outside one:

```css
@layer base {        /* element resets & defaults: h1, p, a … */ }
@layer components {  /* reusable multi-utility patterns: .card … */ }
@layer utilities {   /* single-purpose helpers: .scrollbar-none … */ }
```

## Current theme state

The starter ships a **minimal** theme: just `background` / `foreground` and the
Onest font, with a dark-mode override via `@media (prefers-color-scheme: dark)`.
The `@layer base/components/utilities` blocks are empty — fill them per project.

## Typography

Font: **Onest** (`next/font/google`), bound to `--font-onest` → `--font-sans`.
Loaded in `src/app/layout.tsx` and exposed on `<body>` as `--font-onest`.

## Styling rules

- Use utilities in JSX `className`; keep class strings short and readable.
- Extract repeated multi-class patterns to `@layer components` or a shared component.
- Mobile-first responsive: `sm:` / `md:` / `lg:` / `xl:` prefixes.
- Dark mode: `dark:` prefix or token overrides in a `prefers-color-scheme` block.
- No inline `style` except for dynamic values (e.g. spring-animated values).

## Related

[[component-conventions]] · [[animation-system]] · [[new-page]]
