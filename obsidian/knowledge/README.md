---
tags: [knowledge, moc, stable]
updated: 2026-10-06
---

# Knowledge — what production taught

This folder is the starter's memory of what happened when 50+ animation-heavy
marketing sites built from it were measured, optimised and reviewed on real
phones. It is not a style guide and not a checklist: every entry is something
that **moved a measured number** or **misled someone** on a real site.

| Note | Read it when |
|---|---|
| [[fix-catalog]] | you have a symptom (a score, a freeze, a phone bug) — find the fix that already worked, with its evidence |
| [[pitfalls]] | you are about to measure, probe, script an edit, or act on a hypothesis — find what fooled people before |

The procedures that use them: [[testing-pipeline]] (how to measure, in order, and
the bars) and [[mobile-device-qa]] (what only a phone shows).

## How to use it

1. **Before optimising anything,** read the fix-catalog section for your area and
   the pitfalls' *Measurement* section. Most of a first pass is already written
   down: a client-rendered LCP, a hidden-start hero, raw-path image warming,
   looping springs under reduced motion, per-letter blur, phone frame caps.
2. **Try *rule* entries first**, then *observed* ones — and measure both. An
   observed fix has worked on one or two sites; it is a lead, not a promise.
3. **Read the counter-cases.** Several fixes helped one site and hurt another
   (hydrate-on-approach, a worker on desktop, lazy three.js). The entry says which
   way to lean and what to check afterwards.
4. **Never change the design to win points.** If a score is capped by motion,
   video or content, write the number down and let the client decide.
5. **Starter defaults are listed at the end of the fix-catalog.** Don't undo them
   without re-measuring.

## How to add an entry — evidence before rules

The bar for writing something down here is the same one that built it.

- **A fix enters the catalog only with a measured before → after** under the same
  config (≥ 3 Lighthouse runs, or the scroll test's verdict), say *local* or
  *hosted*, and name the profile (PC / mobile). "Felt faster" is not evidence.
- **Status follows the count of sites, not confidence:**
  - *observed* — measured on 1–2 sites. Write "observed on 1 site".
  - *rule* — reproduced on **3** sites. Only then does a skill or workflow state
    it as the default; promote it in the same change (the skill's text, the
    relevant workflow note, and this entry's status).
  - *counter-case* — a site where it didn't help or hurt. Add it to the entry; a
    rule with a counter-case says when not to apply it.
- **A pitfall enters with what it cost** (the wrong conclusion and how it was
  caught), and what to do instead.
- **Use the entry shape** — [[templates/fix-entry]]: Symptom · Cause · Fix ·
  Evidence · Status. Keep code out of the note: link to the file in `src/` or the
  skill's `references/`.
- **Generic wording.** Name the technique, not the client. Numbers stay.
- **Log it.** A new rule (or a demoted one) is a [[changelog]] entry; a rule that
  changes how work is done is an ADR in [[decisions-log]].

In a project cut from this starter, keep adding to these notes — and when the
same entry appears in three projects, propose it upstream to the starter.

## Related

[[testing-pipeline]] · [[mobile-device-qa]] · [[optimize-load]] ·
[[optimize-performance]] · [[optimize-3d-scene]] · [[decisions-log]] ADR-0026
