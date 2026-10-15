# Preview snippet dragging activates on press-and-hold (@dnd-kit)

The preview surface will later host a contentEditable merged-text editor (Feature 3 Task 3) where a plain click must place the caret, so a sortable that starts dragging immediately on press would swallow clicks. We chose `@dnd-kit` (core + sortable) with a PointerSensor `{ delay, tolerance }` activation constraint — press-and-hold for ~200ms starts the drag, jitter up to the tolerance (5px) is forgiven, and movement beyond the tolerance cancels activation, falling through to click/scroll — plus a KeyboardSensor so the same reorder works without a pointer.

## Considered Options

- **Immediate drag (no constraint, or distance-based activation)** — rejected: a plain click or small text-selection gesture would start a drag, conflicting with the caret-placement click Task 3 requires on the same surface.
- **`@hello-pangea/dnd`** — rejected: its mouse/touch sensors cannot natively express delay-activated dragging, and hold-to-drag is a requirement of the interaction contract.
- **Separate drag handles** — rejected: handle affordances inside the merged-text flow add clutter and another surface to maintain; the whole snippet chip is the handle.

## Consequences

- Plain clicks never start a drag; the click surface stays free for Task 3's contentEditable caret placement (Task 3 adds a drag on/off toggle without changing this activation model).
- The hold delay (200ms) and tolerance (5px) are tunable constants — changing them is a feel change, not a contract change.
- Keyboard reordering (Space/Enter to pick up and drop, arrow keys to move, Escape to cancel) is part of the same contract and must survive the Task 3 document-model migration.
