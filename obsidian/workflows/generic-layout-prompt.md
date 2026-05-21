---
tags: [workflow, template, prompt, stable]
updated: 2026-05-21
---

# Generic Layout Prompt

> Fill-in prompt template for implementing a page/section. Copy the body below,
> replace every `[PLACEHOLDER]`, and hand it to an AI agent. Companion playbook:
> [[new-page]]. The conventions it relies on are documented across the vault —
> see [[ai-agent-guide]] for the rules and [[README|the Map of Content]].

---

We need to implement the **[PAGE NAME]** page/section.

## Design References

- **Desktop Frame:** [Figma URL or frame name]
- **Mobile Frame:** [Figma URL or frame name]

Use the Figma MCP server to fetch exact measurements, colours, typography, and spacing from both frames before writing any code.

---

## Requirements

### 1. Responsive Layout

- Implement **mobile-first** responsive design.
- Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) to adapt for larger screens.
- Inspect both Figma frames and ensure the component structure supports all differences (hidden/shown elements, reordered sections, different type scales).
- The result must match the desktop frame exactly at desktop widths and the mobile frame exactly at mobile widths.

### 2. Component Structure

- Break the UI into **logical, reusable components**.
- Route files (`app/.../page.tsx`) must only import from `views/`. All layout and UI logic lives in a view component (`src/views/[page-name].tsx`) and its sub-components.
- Place new primitives in `components/ui/`, shared infrastructure in `components/common/`, and feature-specific pieces next to the feature.
- **Reuse and extend existing components** before creating new ones. Check `components/ui/` and `components/common/` first.
- Each component must have a clearly typed `interface ComponentNameProps`. No `any`.

### 3. Tailwind & Design Tokens

- All colour, spacing, typography, and radius values must reference design tokens defined in `globals.css` under `:root` / `@theme inline`.
- If a Figma value does not correspond to an existing token, **add it to `globals.css`** before using it — do not hardcode raw values in class names or inline styles.
- Organise new styles into the correct CSS layer:
  - `@layer base` — element resets and defaults
  - `@layer components` — reusable multi-utility patterns
  - `@layer utilities` — single-purpose helpers
- No inline `style` attributes for anything Tailwind can express. Inline styles are only acceptable for dynamic values (e.g. spring-animated values from `@react-spring/web`) or values that cannot be represented as static Tailwind classes.

### 4. Animations

**All motion must use the existing animation components. Do not introduce CSS transitions, CSS keyframes, or any third-party animation library.**

Choose the right primitive for each animation:

| Need | Component |
|---|---|
| Element fades/slides in when scrolled into view | `<Inview from={{}} to={{}} mode="once">` |
| Element moves continuously with scroll (parallax, progress bar) | `<SpringTrigger mode="scrub" from={{}} to={{}}>` |
| Element snaps to a state when a scroll position is passed | `<SpringTrigger mode="toggle">` |
| Mouse hover animation | `<Hover from={{}} to={{}}>` |
| Heading or short copy reveal (line-by-line) | `<TLine tag="h1">text</TLine>` |
| Text animated letter/word by scroll progress | `<TextProgress type="interpolate" letterIn={{}} letterOut={{}}>` |

Rules:
- All animation components accept a `tag` prop — use the semantically correct HTML element (`h1`, `section`, `p`, etc.), not a generic `div`.
- Animation props (`from`, `to`, `config`) must use values that resolve to animatable CSS properties (numbers or strings with units). Never pass Tailwind class names into spring values.
- When you need an animated element to also receive Tailwind classes, pass them via `className` (or `innerClassName` for the inner animated wrapper) — Tailwind classes and spring values coexist via the component's `style` + `className` separation.
- Do not disable animations globally. Use `disableOnMobile` per component when a specific animation degrades mobile UX.
- Staggered entry animations: use `delayIn` with incremental values across siblings.

### 5. Navigation

- Use `<Link>` from `next/link` for all internal navigation.
- Use `useRouter` from `next/navigation` for programmatic navigation.

### 6. Data & State

- **No hardcoded content** inside component files. All text, numbers, and media come from props or hooks.
- If real data is not yet available, place placeholder data in `src/data/mocks/[page-name].ts` and pass it via props — the component itself stays pure.
- Every component that depends on async data must have `loading`, `error`, and `empty` states. Use the existing skeleton components (`SkeletonImage`, `SkeletonLoader`, `SkeletonVideo`) to mirror the final layout.
- Keep data-fetching logic in custom hooks under `src/hooks/`. Presentational components must not contain fetch calls.

### 7. Server vs. Client Components

- Default to **Server Components**. Add `"use client"` only when genuinely required:
  - Event handlers (`onClick`, `onChange`, etc.)
  - Browser-only APIs (`window`, `document`)
  - React hooks (`useState`, `useEffect`, custom hooks)
  - Animation components (all are client — this is expected)
- Never mark a layout or page as `"use client"` just to avoid a small boundary. Split a leaf `"use client"` wrapper instead.

### 8. Accessibility

- Use semantic HTML — never use `<div>` where `<button>`, `<nav>`, `<section>`, `<article>`, etc. are correct.
- All interactive elements must be keyboard-operable and have visible focus styles (use `focus-visible:` utilities).
- Images: always provide meaningful `alt` text. Decorative images use `alt=""`.
- ARIA labels on icon-only buttons and any element with ambiguous role.

### 9. Code Quality

- Follow the naming and folder conventions in [[component-conventions]] and [[folder-structure]].
- Components should be focused and under ~150 lines. Split further if they grow.
- Prefer early returns and flat code over deep nesting.
- No comments that describe what the code does — only comments that explain *why* or document non-obvious constraints.
- No `console.log` in committed code.

---

## What to Deliver

1. All components needed for the page/section, in their correct folders.
2. The view file (`src/views/[page-name].tsx`) assembling those components.
3. Any new design tokens added to `globals.css` (with a comment documenting where they came from).
4. If mock data is needed: `src/data/mocks/[page-name].ts`.
5. A brief summary of:
   - Assumptions made
   - Any new tokens added and why
   - Any Figma values that couldn't be matched to existing tokens (flag for design review)

**Important:** If this is an update to an existing page, preserve all existing logic. Keep diffs minimal and focused on the required changes only.
