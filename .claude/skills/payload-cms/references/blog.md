# The blog kit — posts that rank, signed and clustered

Code: `templates/blog/` (+ `templates/cms-shared/`, added with it).
`bash .claude/skills/payload-cms/scaffold.sh blog` after `core` + `admin`.
Verified end to end on 2026-10-14 against Payload 3.89 / Next 16.3.7 with a
seeded Postgres: types, lint and build clean; every route prerendered (● SSG);
a renamed slug answers 308; Lighthouse A11y / BP / SEO 100 on a post.

## What it ships

| Route | Is | Search reads |
|---|---|---|
| `/blog` | the hub: topics, then every post | SEO global tab `blog`, `BreadcrumbList`, RSS autodiscovery |
| `/blog/<slug>` | a post | `BlogPosting` (author, dates, publisher, section, word count) + breadcrumb; `og:type=article` + `article:*` |
| `/blog/topic/<slug>` | a cluster hub | breadcrumb; `noindex` below `BLOG.minTopicPosts` (2) |
| `/blog/author/<slug>` | an author | `ProfilePage` → `Person` (+ `sameAs`); `noindex` with no post |
| `/blog/feed.xml` | RSS 2.0, newest 30 | — |

Collections (sidebar group *Blog*): **Posts** (drafts → publish), **Topics**,
**Authors**. Posts: title (= `<h1>`), summary (= meta description, card,
feed, llms line), cover (required — Article image, share card), body
(Lexical, h2–h4, internal links pick a post), author, topics (first =
breadcrumb parent), published / revised dates, related (≤ 3, blank → newest
in its topic), a *Search & sharing* tab (title, description, image,
canonical, noindex, snippet preview), and the slug in the sidebar.

## The decisions — and why

| # | Decision | Why |
|---|---|---|
| B1 | One module (`cms/blog.ts`) builds metadata, JSON-LD, sitemap, feed and llms lines | They can't disagree — the commonest blog SEO defect is a sitemap listing a post the page marks `noindex` |
| B2 | `revisedAt` is set by hand; `lastmod` / `dateModified` = `revisedAt ?? publishedAt` — never `updatedAt` | A typo fix is not a revision; dates that move on every save teach Google to ignore them |
| B3 | Old slugs are kept (`previousSlugs`) and answer **308** | Renaming a post must not 404 its backlinks and its search listing |
| B4 | Author pages + `Person` with `url`, `jobTitle`, `sameAs` | Experience and accountability are read from a named, linked author, not "Admin" |
| B5 | Topics are hubs; thin topic pages are `noindex` and out of the sitemap | Topic clusters rank; one-post tag pages are thin content |
| B6 | The hub lists **every** post | No orphans; nothing deeper than home → blog → post |
| B7 | `<h2>` anchors come from `headingsOf()` — the contents list and the renderer share one allocator | `#section` links always land; Google can show jump links |
| B8 | Inline images through `next/image`, the cover `priority` | Payload's default converter ships the full file, eager — the post's LCP |
| B9 | Routes static + `generateStaticParams`; a save → `revalidatePath("/", "layout")` | Hard rule #15; a new post renders on first visit, then is cached |
| B10 | No motion on blog pages | An article is read; no robot form needed beyond `/` |

## Wiring checklist (after `scaffold.sh blog`)

- [ ] `payload.config.ts` — the `[blog kit]` lines are already there; delete
      them if the kit is not installed.
- [ ] `src/lib/routes.ts` — `{ path: "/blog", label: "Blog", summary: "…", indexable: true, changeFrequency: "weekly", priority: 0.7 }`.
      `verify.sh` FAILs on `app/(site)/blog/page.tsx` without it; the
      `[slug]` routes are skipped (they come from the CMS).
- [ ] `src/cms/seo-pages.ts` — a `blog` tab (title 50–60, description
      100–150, written for the subject, not the word "blog").
- [ ] `BLOG.label` = the registry `label`. Rename the hub? Change
      `BLOG.path`, move the folder, update the registry — all three.
- [ ] `src/data/mocks/blog.ts` — the heading and intro for search; add it to
      `TEXT_GLOBALS` (group *Blog*) if the editor should own it.
- [ ] Link `/blog` from the header or footer — `qa:seo` warns on orphans and depth.
- [ ] `sitemap.ts` — add the blog's entries:
  ```ts
  const [pages, blog] = await Promise.all([getSitemapPages(), getBlogSitemap()]);
  // …pages as before, then:
  ...blog.map(({ path, lastModified }) => ({ url: `${siteConfig.url}${path}`, ...(lastModified ? { lastModified } : {}) })),
  ```
  and `export const revalidate = 3600` on the sitemap (a save drops it sooner).
- [ ] `llms.txt/route.ts` — `getBlogLlmsLines()` as an `## Articles` section.
- [ ] Article typography: style `.prose-cms` (`h2`, `h3`, `p`, `ul`, `ol`,
      `a`, `blockquote`, `img`) in `globals.css` with the project's tokens.
- [ ] `yarn generate:types` → `yarn migrate:direct create blog` → `yarn migrate:direct`.
- [ ] Prove: publish two posts in one topic, rename one slug (→ 308), check
      view-source (one `<h1>`, `BlogPosting` + breadcrumb, `article:*` tags),
      `sitemap.xml` (`lastmod` = revised/published day), `/blog/feed.xml`,
      `/llms.txt`, `yarn qa:seo` and `yarn qa:lh` on a post.

## Writing posts that rank (tell the editor; the field hints say it too)

- One post answers one question; the title is that question in searchers'
  words. Open with the answer (answer engines lift the first paragraph).
- One `<h2>` per sub-question; facts with sources and dates; a real author.
- Link to the topic's other posts with descriptive anchors (pick the post in
  the link dialog — the address follows a rename).
- Update a post that's slipping (`/seo-grow`), set *Revised*, don't republish
  it as new.
