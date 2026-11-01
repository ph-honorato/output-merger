# Subtasks for Task 4.2: Spacing Auto-Fix

**Implementation Path:** `.specs/features/04-preview-area-auto-fix/tasks/4.2-spacing-auto-fix/`

## Subtasks

- [x] **Task 4.2.1:** Implement the pure spacing pass: exactly one space between tokens, no space before `.,!;:`, no space after `(` / before `)`, collapse double spaces, trim spaces around line breaks (line breaks themselves preserved) — the before-set gains `?` (a roadmap omission) plus `…` and `)`; and the pass extends the removal-only wording with insertion: a missing space after a punctuation-ending token is inserted at token-boundary seams (chip↔own text, own text↔chip, chip↔chip) — never inside token interiors, and non-punctuation glue stays glued; document edges trimmed (user decisions 2026-10-23; see ADR 0005)
- [x] **Task 4.2.2:** Wire the pass into the same trigger points (creation, sort, copy); frozen tokens skipped (the auto-fix pass composes case → spacing → case so one application reaches the settled document; frozen chips' text — edges included — is untouched while the spacing around them is corrected; the reconcile no-op comparison canonicalizes through the composed pass; user decisions 2026-10-23; see ADR 0005)
- [x] **Task 4.2.3:** Tests: unit rule tables + integration (creation, sort and copy outputs)

## Related Sub-Folders

- **4.2.1-review-fixes** — Internal review fixes for Spacing Auto-Fix (7 findings, 5 fixed, 2 deferred with documentation)