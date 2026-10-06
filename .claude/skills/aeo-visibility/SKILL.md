---
name: aeo-visibility
description: Answer Engine Optimisation — make the site citable by ChatGPT, Claude, Perplexity, Gemini and AI Overviews. Covers answer-first content structure, llms.txt, AI crawler access, entity consistency, and auditing how the brand currently appears in AI answers. Use when the user mentions AEO, GEO, "AI search", "get cited by ChatGPT", "llms.txt", "AI crawlers", or wants visibility beyond classic search rankings.
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, WebFetch, WebSearch
---

# AEO — being citable, not just rankable

Classic SEO gets you ranked. AEO gets you **quoted**. The mechanics differ: answer
engines extract self-contained claims from crawlable text, and they weight
consistency of facts about an entity across the whole web.

## 1. Let the crawlers in — deliberately

- `src/app/robots.ts` decides this. Answer-engine crawlers include `GPTBot`,
  `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`,
  `PerplexityBot`, `Google-Extended`, `CCBot`, `Bytespider`.
- **Ask the user before changing this.** "Be cited by AI" and "don't train on my
  content" are different goals with different bots: training crawlers
  (`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`) versus live search/citation
  crawlers (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`). Blocking the
  training set while allowing the search set is a coherent position; blocking
  everything and expecting citations is not.
- Verify server-side rendering: answer-engine crawlers are far less reliable at
  executing JavaScript than Googlebot. Anything client-rendered may be invisible
  to them. In this starter, content is server-rendered and animations only
  animate — keep it that way.
- **AI crawlers get the robot form.** `src/utils/bot-ua.ts` lists them next to
  the search engines, so the proxy serves them the page at rest (no intro, every
  line of copy in the HTML). The starter's original list knew search engines and
  lab tools but not AI crawlers — they got the people form, where streamed copy
  sat in `hidden` segments. When a new AI crawler appears, add it there (one
  regex for the proxy and `isBot()`).
- **Read the page as they do** — no JS:
  `curl -s -A "GPTBot/1.0" <url>/` (and `ClaudeBot`, `PerplexityBot`). The `<h1>`
  and body copy must be present and **not under a `hidden` ancestor**. On
  production sites built from the old starter an empty `app/loading.tsx` put the
  whole page inside `<div hidden>`; after deleting it, two sites went from h1
  HIDDEN and 394 / 1,619 hidden characters to **0**. Text a client-only scene
  paints into a canvas doesn't exist for them — keep an HTML twin.

## 2. `llms.txt`

A plain-markdown map of the site at `/llms.txt` for language models. Serve it
from `src/app/llms.txt/route.ts` (a Route Handler returning `text/plain`) so it
stays in sync with real routes rather than rotting as a static file.

```
# <Site name>
> One-sentence description of what the company does and for whom.

## Core pages
- [Services](https://example.com/services): what is offered, to whom
- [About](https://example.com/about): who the company is, founded, location

## Key facts
- Founded: 2019 · HQ: Berlin · Focus: <specifics>
```

Keep it factual and short. It is a summary for a machine, not a marketing page.

## 3. Structure content so it can be extracted

- **Answer first.** Lead each section with the direct claim in one or two
  sentences, then support it. Content that builds to a conclusion gets skipped.
- **One idea per heading**, and phrase headings as the questions people ask.
- **Self-contained sentences.** "Our approach is faster" is unusable out of
  context; "Textura ships marketing sites in four weeks" survives extraction.
- **Concrete specifics** — numbers, dates, named methods, prices where possible.
  Vague marketing language is unquotable.
- **Comparison and definition content** punches above its weight: "X vs Y",
  "What is X", pricing pages, and genuine FAQs.
- Mark FAQs up with `FAQPage` (see the `schema-markup` skill).

## 4. Entity consistency

Answer engines assemble a picture of the brand from many sources. Contradictions
dilute it. Keep the name, description, founding year, location and offering
identical across — starting with the site's own `siteConfig` (title, OG,
manifest, JSON-LD must all carry the brand as its logo writes it, never a
starter placeholder) — the site, `Organization` JSON-LD, `llms.txt`, LinkedIn,
Crunchbase, G2, Google Business Profile, and any press coverage.

## 5. Audit current visibility

Ask the user for the brand, category and 3–5 competitors, then test the prompts
their buyers would actually use — "best <category> for <use case>", "alternatives
to <competitor>", "<brand> review", "how to <problem the product solves>". For
each: is the brand mentioned, in what position, is the description accurate, what
sentiment, who is mentioned instead. Use WebSearch to check what public sources
currently say — that is the raw material the models are drawing on.

Report as a table plus a prioritised action list. Be honest that this is a
point-in-time sample, that answers vary between runs and platforms, and that
changes take weeks or months to surface.

## 6. What actually moves the needle

Third-party corroboration outweighs anything you publish about yourself:
being in "best of" roundups and comparison articles, community mentions where
your buyers ask questions, original data worth citing, and up-to-date profiles on
the aggregators that models read. Publishing more pages about yourself does not
substitute for it.
