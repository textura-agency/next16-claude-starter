---
name: payload-analytics
description: Light, consented, cookieless, self-hosted visitor analytics inside the Payload admin — a page-views collection in the CMS's own Postgres written by a same-origin /api/track beacon, an Analytics view (visitors, views, average visible time on page, bounce rate, live visitors, a day-by-day chart with a metric switch, top pages, referrers, countries, languages, devices, browsers, systems, 7/30/90-day ranges vs the period before) and a 7-day dashboard card. No third-party script, no new dependency. Use when the user wants "analytics in the admin", "who visited, how many times, from where", "a chart of visits", "time on page", or a privacy-first alternative to GA on a Payload site.
---

# Analytics in the admin

What an owner wants from "light analytics": how many people came, what they
read and for how long, where from, on what — in the admin they already use.
What they must not get: a third-party script on the page, a cookie, or a
promise in the privacy policy the site doesn't keep. Kit:
`bash .claude/skills/payload-cms/scaffold.sh analytics` (needs `core` + `admin`).

## Decisions — and why

| # | Decision | Why |
|---|---|---|
| A1 | **Self-hosted** in the CMS's Postgres (`page-views`, hidden from the nav), read with plain SQL (`readStats`) | No vendor, no script, no dependency; the data sits beside the content it describes |
| A2 | **Only with consent**: the beacon fires only when `consent.analytics === true` | The cookie banner's analytics switch must mean something — and the privacy policy promises it |
| A3 | `/api/track` **drops** bots (UA regex incl. Lighthouse/headless/monitors), `/admin` + `/api` paths, **DNT** and **GPC** | Counts people, not crawlers or the editor; honours "do not track" even with consent |
| A4 | **No personal data kept**: visitor = `sha256(PAYLOAD_SECRET + day + IP + UA)` truncated; IP and UA never stored; no cookie of our own | One person = one visitor per day, unlinkable across days. "Visitors" over a range = sum of daily visitors (what privacy-first tools call visits) |
| A5 | **Time on page = visible time**, banked across visibility changes, sent once on leave (`pagehide` / hidden / route change), capped at 30 min, written only by the same day-hash, only once | A background tab doesn't inflate it; the id can't be used to rewrite other rows. Views with no clean leave are excluded from the average, not counted as 0 |
| A6 | **Country from the edge header** (`x-vercel-ip-country` / `cf-ipcountry`), else the `Accept-Language` region flagged `countryApprox` and footnoted | Exact on the host, honest locally |
| A7 | **Retention = the privacy policy's figure** (default 14 months), swept on ~1 % of writes | The policy and the database agree, with no cron |
| A8 | **Server-rendered view**; the chart is one client leaf — **plain SVG, no chart library, no animation**; hover is a discrete state | No dependency, no motion-rule exception; lists are plain HTML |
| A9 | Countries as a **code badge + English name** (`Intl.DisplayNames`) | Windows draws flag emoji as bare letters |
| A10 | Bounce rate = visitor-days with one view; every KPI compared with the previous period, colour by better/worse (bounce inverted) | The four numbers an owner asks about, with direction |

## Steps

1. **Check the consent flow first.** "Accept all" must save `analytics: true`
   (the starter does; an older site saved all categories off). The cookie
   banner/dialog must have an analytics category, and the privacy policy must
   say: what is collected (path, referrer host, device class, browser, OS,
   country, language, visible time), that it's consent-only, no cookie, no IP
   stored, and the retention. Set `RETENTION_DAYS` in `cms/analytics.ts` to the
   policy's number. **If the policy says otherwise, ask before shipping.**
2. Scaffold; register `PageViews` in `payload.config.ts`, the dashboard card,
   the *Insights → Analytics* nav link and the `/analytics` view (marked lines).
3. Put `<AnalyticsBeacon />` in `SiteDocument` (after the cookie banner). It
   renders nothing and posts nothing until consent.
4. `PAYLOAD_SECRET` must be set (it salts the hash) and `DATABASE_URL` reachable —
   without either, `/api/track` answers `{ counted: false }` and nothing breaks.
5. `yarn generate:types` → `yarn migrate:direct create page_views` →
   `yarn migrate:direct` → `yarn generate:importmap`.
6. `robots.ts` already disallows `/api/`.

## Prove it

- Fresh profile, no consent → Network: no `/api/track`. Reject → none. Accept →
  one POST per route change, `{ data: { counted: true, id } }`.
- Switch tabs away and back, then navigate → a second POST `{ id, seconds }`
  with roughly the visible time only.
- `curl -X POST …/api/track -H 'dnt: 1' …` → `counted: false`; a bot UA → `false`;
  `{ id: <someone else's>, seconds }` → `false`.
- `/admin/analytics` shows the views; ranges switch; the chart's hover readout
  works with mouse; the 7-day card is on the dashboard.
- Locally the country is approximate and footnoted; on the host it is exact.
- Lighthouse unchanged (the beacon is idle until consent; Lighthouse never
  consents) — and Lighthouse runs are not counted (bot regex).
- `select count(*) from page_views where created_at < now() - interval '<retention>'` → 0 after sweeps.

## Extending

Add a dimension = a column on `page-views` + a migration + a `run(sql…)` in
`readStats` + a `RankList`. Keep the rule: reduce before storing — never store a
raw IP, full UA, full referrer URL or anything that identifies a person.
