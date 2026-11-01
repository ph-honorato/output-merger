# Subtasks for Task 3.3: Editable Preview Text

**Implementation Path:** `.specs/features/03-preview-area-tools/tasks/3.3-editable-preview-text/`

## Subtasks

- [x] **Task 3.3.1:** Extend SnippetsContext into a preview document model (snippet tokens + own-text tokens + line breaks), migrating Task 3.1 reorder onto it
- [x] **Task 3.3.2:** Build the editable preview surface (contentEditable rendering colored snippet tokens, textarea-like caret/selection)
- [x] **Task 3.3.3:** Verify the click-vs-drag contract (click = caret, hold = drag) and add an edit-text toggle gating editing only — dragging stays always live in both modes (deviation from the "drag on/off toggle", user decision 2026-10-16; see ADR 0004)
- [x] **Task 3.3.4:** Implement edit parsing/sync: own text insertion, Enter → line break, deletion at boundaries, typing inside a snippet integrates into the token — no split (deviation from "splits it between words", user decision 2026-10-16; see ADR 0004); focused surface owns its DOM, blurred surface re-renders from the model
- [x] **Task 3.3.5:** Update merged-text building/copy to serialize the document (own text + newlines for line breaks)
- [x] **Task 3.3.6:** Tests: editing workflows, parse/serialize round-trips, inline-modal sync

## Related Sub-Folder (Became Separate Task)

- **3.3.1-review-fixes** — Automated review fixes for preview-area-tools (13 findings from `develop..feature/preview-area-tools`)