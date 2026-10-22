# Roadmap

## Epics

### v0: Minimum Viable Product (MVP)

- Description: The user can add up to 6 different texts and start the merge session. The user can select text parts with the mouse to auto-include in the preview. At the preview area, the user can then drag previously highlighted text snippets, create line breaks, split highlighted snippets between words and add own text. Routing will be handled by Tanstack Router, with the Merge Session page at "{base_url}/". Includes translations for en-US and pt-BR.
- Status: In Progress

#### Features for v0

- [x] **Feature 1: Project Setup & Foundation** - Set up the complete project foundation including project structure, styling, routing, and base components
  - [x] Set up the project structure (frontend with Vite, React, TypeScript)
  - [x] Set-up styled-components and MUI
  - [x] Create Header component with the name of the project on the left (should be responsive)
  - [x] Set up translation for en-US and pt-BR (There is already a basic implementation and translation files). And add a translation button on the Header component.
  - [x] Install and set-up tanstack react router.
  - [x] Create a "MergeSession" Page. It should be empty by now, just follow the design.md patterns. Set-up "/" in react router for this Page.
- [x] **Feature 2: Text Merging** - Core text merging functionality
  - [x] **Task 1: Text Input Component** - Core component with input/view modes and needle-based selection
    - [x] Task 1.1: Implement input mode with textarea (max 500 characters)
    - [x] Task 1.2: Implement view mode showing text without textarea
    - [x] Task 1.3: Implement needle system: two needles (start/end handles) appearing on hover at word boundaries for drag-to-highlight
    - [x] Task 1.4: Implement snippet creation on drag end with {id, text, startIndex, endIndex, color}
    - [x] Task 1.5: Implement snippet resizing via needle drag
    - [x] Task 1.6: Support multiple snippets per text
    - [x] Task 1.7: Implement onChange callback returning array of all snippets
    - [x] Task 1.8: Add default highlight color with prop override
  - [x] **Task 2: MergeSession Page Layout** - Three-column layout with ActionsBar
    - [x] Task 2.1: Create ActionsBar component spanning full width of three columns
      - [x] Task 2.1.1: "Start Merge" button aligned right
    - [x] Task 2.2: Add two TextInput components in columns 1 & 2 (each with unique highlight color)
    - [x] Task 2.3: Add PreviewArea placeholder stub in column 3 (full component built in Task 4)
    - [x] Task 2.4: Implement responsive three-column grid layout (stacks vertically on mobile)
  - [x] **Task 3: Global Snippets Context** - Centralized snippet state management
    - [x] Task 3.1: Create global context for snippets with order property (default: user selection order)
    - [x] Task 3.2: Update context when user creates snippet in any input
    - [x] Task 3.3: Connect TextInput onChange to global context
  - [x] **Task 4: PreviewArea Component** - Display snippets from global context
    - [x] Task 4.1: Create PreviewArea component in column 3 (replacing the placeholder stub)
    - [x] Task 4.2: Connect PreviewArea to consume snippets from global context with order property
    - [x] Task 4.3: Display snippets side by side with source color highlighting
    - [x] Task 4.4: Add a sideway copy tool to copy full built text

  - [x] **Task 5: Start Merge Logic** - Switch to merge mode
    - [x] Task 5.1: Page loads with inputs in input mode; after "start merge", inputs become view mode
    - [x] Task 5.2: Needles enable snippet creation; each created snippet auto-appears in the preview area
  - [x] **Task 6: UI Adjustments** - UI refinements for the MergeSession Page (last task of Feature 2)
    - [x] Task 6.1: In-page tutorial explaining how to use the merge session page
    - [x] Task 6.2: Adjust minimal height of textareas (Input and PreviewArea) (suggestion: 400px)
    - [x] Task 6.3: ActionsBar should have a fixed height too, so if a button disappears it does not change height
    - [x] Task 6.4: The copy button should be inside at the top of a vertical bar, this bar should be placed at the right of the preview area, decoupled from the container

- [x] **Feature 3: Preview Area Tools** - Implement the preview area with:
  - [x] **Task 1: Sort Snippets by Dragging** - Sort highlighted text snippets by dragging (using `@dnd-kit/core`)
    - [x] Task 1.1: Install and set up `@dnd-kit/core` and `@dnd-kit/sortable`
    - [x] Task 1.2: Add snippet reorder support to SnippetsContext (reducer action + `moveSnippet` API)
    - [x] Task 1.3: Configure sensors: PointerSensor with hold-to-drag activation constraint (delay + tolerance) and KeyboardSensor for accessibility
    - [x] Task 1.4: Make preview segments sortable (DndContext + SortableContext), wiring drag end to `moveSnippet`, keeping space separators and empty state working
    - [x] Task 1.5: Tests: reducer reorder unit tests + component drag/keyboard sorting tests
    - [x] Task 1.6: Add user feedback while sorting
  - [x] **Task 2: Preview Area Modal** - Open the preview area on a modal (bigger view of the same preview)
    - [x] Task 2.1: Create PreviewModal component in MergeSession components folder (MUI Dialog, full component structure)
    - [x] Task 2.2: Add open-preview button to the PreviewToolbar with translations (en-US/pt-BR)
    - [x] Task 2.3: Manage open/close state and render the same PreviewArea inside the modal (shared state via context, no duplication)
    - [x] Task 2.4: Responsive + accessibility pass (ESC/backdrop close, focus trap; trigger hidden on mobile — user decision 2026-10-15 supersedes "full-screen on mobile", fullScreen only on the resize edge; see ADR 0003 and `.specs/features/preview-area-tools/tasks/preview-area-modal`)
    - [x] Task 2.5: Tests: modal open/close, preview content rendering, copy button integration
  - [x] **Task 3: Editable Preview Text** - Make the text on the preview area editable (inline and in the modal)
    - [x] Task 3.1: Extend SnippetsContext into a preview document model (snippet tokens + own-text tokens + line breaks), migrating Task 1 reorder onto it
    - [x] Task 3.2: Build the editable preview surface (contentEditable rendering colored snippet tokens, textarea-like caret/selection)
    - [x] Task 3.3: Verify the click-vs-drag contract (click = caret, hold = drag) and add an edit-text toggle gating editing only — dragging stays always live in both modes (deviation from the "drag on/off toggle", user decision 2026-10-16; see ADR 0004 and `.specs/features/preview-area-tools/tasks/editable-preview-text`)
    - [x] Task 3.4: Implement edit parsing/sync: own text insertion, Enter → line break, deletion at boundaries, typing inside a snippet integrates into the token — no split (deviation from "splits it between words", user decision 2026-10-16; see ADR 0004 and the same spec folder); focused surface owns its DOM, blurred surface re-renders from the model
    - [x] Task 3.5: Update merged-text building/copy to serialize the document (own text + newlines for line breaks)
    - [x] Task 3.6: Tests: editing workflows, parse/serialize round-trips, inline-modal sync
- [ ] **Feature 4: Preview Area Auto fix**
- [ ] **Feature 5: ActionsBar Extensions** - Additional action buttons on the MergeSession ActionsBar (including third text input support)
  - [ ] "Start Over" button (reset page without reload)
  - [ ] "Add Text" button (add new text input, up to 4 total)
  - [ ] Implement logic to handle three or more text inputs in the merge session
- [ ] **Feature 6: Release Preparation** - Finalize and prepare for release

### v1: "Merges" CRUD

- Description: The user must log in and navigate to a sessions screen, where they can start a new "merge" session or return to an existing one. Additional tools may also be added to the text preview interface. Routing will support "{base_url}/sessions/{merge_session_id}" for accessing different sessions.
- Status: To be started

### v2: AI Integration

- Description: The user can choose between manual input (the current setup) or model output. Selecting model output will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions.
- Status: To be started
