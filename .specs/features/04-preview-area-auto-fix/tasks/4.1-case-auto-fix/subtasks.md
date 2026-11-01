# Subtasks for Task 4.1: Case Auto-Fix

**Implementation Path:** `.specs/features/04-preview-area-auto-fix/tasks/4.1-case-auto-fix/`

## Subtasks

- [x] **Task 4.1.1:** Implement the pure case-fix pass in the preview document utils: predecessor classifier (document start, `.` `!` `?`, line break, mid-sentence) with capitalize-after-sentence-start and lowercase-after-mid-sentence rules, plus guards (acronyms/all-caps, camelCase brands, digit-leading snippets, frozen tokens) — the "standalone 'I'" and "capitals that were already mid-sentence in the source" guards were dropped (user decision 2026-10-22; see ADR 0005)
- [x] **Task 4.1.2:** Wire the pass into snippet creation/reconciliation and sort (covers the moved snippet and the tokens whose predecessor changed); skip frozen tokens and make reconciliation comparisons case-aware so corrected tokens aren't misdetected as user-edited (the case-aware comparison is the reconcile no-op guard only — edited-detection and the focused-surface comparison stay exact so manual case overrides freeze the chip and survive sorts, user decision 2026-10-22; see ADR 0005). Text inputs are never modified
- [x] **Task 4.1.3:** Apply the pass on the copy path before serialization (inline + modal) so the clipboard is always fully corrected, without mutating the visible document
- [x] **Task 4.1.4:** Tests: unit rule/guard tables + integration (create, sort both sides, manual override survives, copy output)

## Related Sub-Folder

- **4.2.1-review-fixes** — Review fixes for Case Auto-Fix (external code review, 2 findings)