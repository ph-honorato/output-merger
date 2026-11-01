# Subtasks for Task 3.1: Sort Snippets by Dragging

**Implementation Path:** `.specs/features/03-preview-area-tools/tasks/3.1-sort-snippets-by-dragging/`

## Subtasks

- [x] **Task 3.1.1:** Install and set up `@dnd-kit/core` and `@dnd-kit/sortable`
- [x] **Task 3.1.2:** Add snippet reorder support to SnippetsContext (reducer action + `moveSnippet` API)
- [x] **Task 3.1.3:** Configure sensors: PointerSensor with hold-to-drag activation constraint (delay + tolerance) and KeyboardSensor for accessibility
- [x] **Task 3.1.4:** Make preview segments sortable (DndContext + SortableContext), wiring drag end to `moveSnippet`, keeping space separators and empty state working
- [x] **Task 3.1.5:** Tests: reducer reorder unit tests + component drag/keyboard sorting tests
- [x] **Task 3.1.6:** Add user feedback while sorting

## Related Sub-Folder (Became Separate Task)

- **3.1.1-sorting-drop-indicator** — Drop indicator needle visual feedback during drag (extends Task 3.1 drag-visual feedback)