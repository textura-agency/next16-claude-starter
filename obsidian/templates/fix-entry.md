---
tags: [template, knowledge]
updated: 2026-10-06
---

# Fix entry — template

> Copy this block into [[fix-catalog]] under the right area (or the pitfall form
> into [[pitfalls]]). Rules for evidence: [[knowledge/README]].

```markdown
### <short imperative name — what to do>
- **Symptom:** the audit / metric / visible bug that points at it, and how to
  recognise it (LCP phase, scroll-test cause column, profile line).
- **Cause:** why it happens, in one or two lines.
- **Fix:** what to change. Code lives in `src/…` or the skill's `references/` —
  link it, don't paste it.
- **Evidence:** <n> site(s) — <profile> <metric> <before> → <after>, <runs> runs,
  local | hosted. Counter-case: <where it didn't help, and why>.
- **Status:** observed (1–2 sites) · rule (≥ 3) · inherited.
```

Pitfall form:

```markdown
- **<what looked true>.** What it cost (the wrong conclusion, how it was caught),
  and what to do instead.
```

## Related

[[fix-catalog]] · [[pitfalls]] · [[knowledge/README]]
