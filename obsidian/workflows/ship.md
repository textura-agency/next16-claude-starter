---
tags: [workflow, deploy, stable]
updated: 2026-09-18
---

# Workflow — Ship

The pre-launch gate. Procedure lives in the `ship-check` skill (`/ship`); this
note records the target, the budget and the deployment facts.

## Gates, in order

1. `yarn lint` · `yarn build` · `.claude/scripts/verify.sh` — zero FAILs
2. [[qa-verification]] across every route and breakpoint
3. [[seo-aeo]] — indexability first, then metadata, structure, schema
4. Performance budget (below), **measured** — [[optimize-load]] across laptop,
   tablet and mobile; [[optimize-performance]] as well if the page is animated
5. Accessibility — keyboard pass, reduced motion, contrast, touch targets
6. Secrets & env hygiene
7. Deploy, then verify the deployed thing

If the project replaces an existing live site, [[site-migration]]'s redirect map
must be complete and live **before** launch. This gate blocks on it.

## Performance budget

| Metric | Target |
|--------|--------|
| Lighthouse, all four categories | ≥ 90 on laptop, tablet **and** mobile |
| LCP | ≤ 2.5s |
| CLS | ≤ 0.1 |
| INP | ≤ 200ms |
| Animation | 60fps on a mid-range phone |

Take the **median of 3+ runs** per profile — a single run is an anecdote. Where a
target cannot be met without changing the design's motion or content budget, ship
the number and the reason rather than a silent miss ([[optimize-load]]).

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
- `NEXT_PUBLIC_SITE_URL` must point at the production domain or every canonical
  and OG URL resolves to localhost.
- With Payload: migrations run against the **direct** connection, and `push` is
  `false` in production — see [[cms-payload]].

## Post-deploy verification

A real page loads · a form submits and hits the API route · an image from storage
renders · `/robots.txt` and `/sitemap.xml` return the expected content · the
custom domain resolves over HTTPS with `www`/apex normalised one way.

## Related

[[qa-verification]] · [[seo-aeo]] · [[site-migration]] · [[environment-variables]] · [[agent-harness]]
