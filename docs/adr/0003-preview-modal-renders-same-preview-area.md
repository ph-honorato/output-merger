# The preview modal renders the same PreviewArea component — duplicate data-testids while it is open are by design

The preview modal (Feature 3 Task 2) renders the same `PreviewArea` component as the inline preview — no modal-specific variant — so both surfaces always show the same merge order from the shared SnippetsContext. While the modal is open, two instances are mounted simultaneously, so every testid inside PreviewArea (`preview-area`, `preview-snippet`, …) and the copy button exists twice in the DOM. We accept this by design: MUI's ModalManager keeps the app behind the dialog `aria-hidden` from assistive tech, and tests that touch the open modal scope their queries with `within(getByRole('dialog'))`. The modal's content unmounts when it closes (no `keepMounted`), so duplicates exist only while the modal is open.

## Considered Options

- **Modal-specific preview variant with prefixed testids** — rejected: forks the component; Task 3's contentEditable surface would have to be built twice, or the variant would degenerate into forwarding everything to the real component.
- **A testid-prefix prop on PreviewArea** — rejected: leaks a test-only concern into the production component contract for a convenience that `within()`-scoping already provides.
- **Unmount the inline preview while the modal is open** — rejected: remount churn on every open/close and it forfeits the cheaply testable both-surfaces-stay-in-sync invariant.
- **Same component, duplicates by design** — chosen.

## Consequences

- While the modal is open, global testid queries return multiple matches by design; new modal tests must scope queries to the dialog (`within(getByRole('dialog'))`); existing single-instance suites are unaffected.
- Screen readers are unaffected: the background (including the inline preview) is `aria-hidden` while the dialog is open.
- Task 3's contentEditable migration changes exactly one component; the modal inherits it for free.
- Each mounted instance keeps its own DndContext (Task 1 decision): the modal's preview sorts independently, never across instances.
- The modal's content unmounts on close (no `keepMounted`): only one instance exists in the DOM whenever the modal is closed.
