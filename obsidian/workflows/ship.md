---
tags: [workflow, deploy, stable]
updated: 2026-10-06
---

# Workflow — Ship

The pre-launch gate. Procedure lives in the `ship-check` skill (`/ship`); this
note records the target, the budget and the deployment facts.

## Gates, in order

1. `yarn lint` · `yarn build` · `.claude/scripts/verify.sh` — zero FAILs
2. [[qa-verification]] across every route and breakpoint
3. [[seo-aeo]] — indexability first, then metadata, structure, schema
4. The budget (below), **measured** in the order of [[testing-pipeline]] —
   Lighthouse PC + mobile (people + robot), the scroll test, the mobile/iOS
   probes, the axe sweep — [[optimize-load]], [[optimize-performance]],
   [[optimize-3d-scene]] for whatever falls short
5. Accessibility — keyboard pass, reduced motion (`qa:motion`: the page stays
   responsive), contrast through the entrance (`qa:axe`), touch targets
6. Brand kit — favicon set, 1200 × 630 share image, real title/description
   (`qa:brand`)
7. Secrets & env hygiene
8. Deploy, then verify the deployed thing — **the hosted numbers are the record**
9. **A real phone** — [[mobile-device-qa]]'s device walk on the deployed preview

If the project replaces an existing live site, [[site-migration]]'s redirect map
must be complete and live **before** launch. This gate blocks on it.

## Performance budget

| Metric | Target |
|--------|--------|
| Lighthouse Performance | **≥ 90 on PC and on mobile** (people runs, real host) |
| Lighthouse Accessibility, Best Practices, SEO | **100** on PC and mobile, people runs **and** the robot form |
| Scroll test | **ideal** on PC and mobile — no frame > 50 ms, ≤ 1 % dropped, p99 ≤ 33 ms, cold and warm |
| LCP | ≤ 2.5s |
| CLS | ≤ 0.1 |
| INP | ≤ 200ms |
| Phone | `qa:ios`, `qa:fps`, `qa:context` pass; the scene draws at the display rate (no fixed cap); checked on a real iPhone |

These are the bars 50+ production sites built from this starter were taken to
([[decisions-log]] ADR-0026). Take the **median of 3+ runs** per profile — a
single run is an anecdote — and judge load on the real host: localhost LCP is not
what PageSpeed or a visitor sees ([[pitfalls]]). Where a target cannot be met
without changing the design's motion or content budget, ship the number and the
reason rather than a silent miss ([[optimize-load]]).

This starter is animation-heavy, so the usual offenders are ours: an unprioritised
hero image, layout-animating springs, and WebGL. A three.js/WebGL scene goes
through [[optimize-3d-scene]] before this gate, not after.

## Deployment target

**Vercel.** Route handlers run on Fluid Compute (Node.js) — do not use the Edge
runtime, and note that Next 16 removed it from `proxy.ts` anyway (see [[routing]]).

- `vercel` for a preview, `vercel --prod` for production, or the Git integration.
- Production env vars must be set for the **Production** environment specifically,
  not only Preview. A missing var fails the zod parse in `src/env.ts` at boot —
  which is intended, so check before launch rather than discovering it live.
- The site's origin falls back `NEXT_PUBLIC_SITE_URL` → Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL` → localhost. Set `NEXT_PUBLIC_SITE_URL` when the
  canonical domain differs from Vercel's production domain. Empty optional vars
  copied from `.env.example` must parse as unset, not `""`.
- A deploy stuck at `BLOCKED` / `TEAM_ACCESS_REQUIRED` is usually a repo-local
  `git config user.email` outside the Vercel team.
- With Payload: migrations run against the **direct** connection, and `push` is
  `false` in production — see [[cms-payload]].

## Post-deploy verification

A real page loads · a form submits and hits the API route · an image from storage
renders · `/robots.txt` and `/sitemap.xml` return the expected content · the
custom domain resolves over HTTPS with `www`/apex normalised one way ·
**the canonical is the real origin, and the `og:image` URL returns 200** ·
`curl -sI /` shows a static, cached page (not `private, no-store`) ·
`curl -A GPTBot /` shows the copy outside any `hidden` element · the robot
Lighthouse on the host reads A11y/BP/SEO 100 · the [[mobile-device-qa]] device
walk on a real phone.

## Related

[[testing-pipeline]] · [[mobile-device-qa]] · [[qa-verification]] · [[seo-aeo]] · [[site-migration]] · [[environment-variables]] · [[agent-harness]]
