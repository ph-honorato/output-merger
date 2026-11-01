# Roadmap

## Epics

### v0: Minimum Viable Product (MVP)

- Description: The user can add up to 2 different texts and start the merge session. The user can select text parts with the mouse to auto-include in the preview. At the preview area, the user can then drag previously highlighted text snippets, create line breaks, split highlighted snippets between words and add own text. Routing will be handled by Tanstack Router, with the Merge Session page at "{base_url}/". Includes translations for en-US and pt-BR. **Future extension: support for up to 6 text inputs.**
- Status: In Progress

#### Features for v0

- [x] **Feature 1: Project Setup & Foundation** — Set up the complete project foundation including project structure, styling, routing, and base components
  - [x] Task 1.1: Set up the project structure (frontend with Vite, React, TypeScript)
  - [x] Task 1.2: Set-up styled-components and MUI
  - [x] Task 1.3: Create Header component with the name of the project on the left (should be responsive)
  - [x] Task 1.4: Set up translation for en-US and pt-BR. Add translation button on Header
  - [x] Task 1.5: Install and set-up TanStack React Router
  - [x] Task 1.6: Create "MergeSession" Page (empty, follows design.md patterns). Set-up "/" in router

- [x] **Feature 2: Text Merging** — Core text merging functionality
  - [x] Task 2.1: Text Input Component — Core component with input/view modes and needle-based selection — implementation details on `.specs/features/02-text-merging/tasks/2.1-text-input/`
  - [x] Task 2.2: MergeSession Page Layout — Three-column layout with ActionsBar — implementation details on `.specs/features/02-text-merging/tasks/2.1-text-input/` (integrated)
  - [x] Task 2.3: Global Snippets Context — Centralized snippet state management — implementation details on `.specs/features/02-text-merging/tasks/2.3-global-snippets-context/`
  - [x] Task 2.4: PreviewArea Component — Display snippets from global context — implementation details on `.specs/features/02-text-merging/tasks/2.4-preview-area/`
  - [x] Task 2.5: Start Merge Logic — Switch to merge mode — implementation details on `.specs/features/02-text-merging/tasks/2.5-start-merge/`
  - [x] Task 2.6: UI Adjustments — UI refinements for the MergeSession Page — implementation details on `.specs/features/02-text-merging/tasks/2.6-ui-fixes/`
  - [x] Task 2.6.1: Preview Area Adjustments — Toolbar on mobile, empty state tutorial hint, left-aligned snippet text — implementation details on `.specs/features/02-text-merging/tasks/2.6.1-preview-area-adjusts/`
  - [x] Task 2.6.2: Preview Area Text Flow — Long word breaking, continuous text with source-color highlights — implementation details on `.specs/features/02-text-merging/tasks/2.6.2-preview-area-text-flow/`

- [x] **Feature 3: Preview Area Tools** — Implement the preview area with drag-sort, modal, and editing
  - [x] Task 3.1: Sort Snippets by Dragging — Sort highlighted text snippets by dragging (using `@dnd-kit/core`) — implementation details on `.specs/features/03-preview-area-tools/tasks/3.1-sort-snippets-by-dragging/`
  - [x] Task 3.1.1: Sorting Drop Indicator — Drop indicator needle visual feedback during drag — implementation details on `.specs/features/03-preview-area-tools/tasks/3.1.1-sorting-drop-indicator/`
  - [x] Task 3.2: Preview Area Modal — Open the preview area on a modal (bigger view of the same preview) — implementation details on `.specs/features/03-preview-area-tools/tasks/3.2-preview-area-modal/`
  - [x] Task 3.3: Editable Preview Text — Make the text on the preview area editable (inline and in the modal) — implementation details on `.specs/features/03-preview-area-tools/tasks/3.3-editable-preview-text/`
  - [x] Task 3.3.1: Review Fixes — Automated review fixes for preview-area-tools (13 findings) — implementation details on `.specs/features/03-preview-area-tools/tasks/3.3.1-review-fixes/`

- [ ] **Feature 4: Preview Area Auto Fix** — Auto-correct snippet case and spacing in the preview area
  - [x] Task 4.1: Case Auto-Fix — Snippet capitalization follows its new context in the preview — implementation details on `.specs/features/04-preview-area-auto-fix/tasks/4.1-case-auto-fix/`
  - [x] Task 4.2: Spacing Auto-Fix — Punctuation-adjacent spacing in the preview — implementation details on `.specs/features/04-preview-area-auto-fix/tasks/4.2-spacing-auto-fix/`
  - [x] Task 4.2.1: Review Fixes — External review fixes for Case Auto-Fix (2 findings) and internal review fixes for Spacing Auto-Fix (7 findings, 5 fixed, 2 deferred) — implementation details on `.specs/features/04-preview-area-auto-fix/tasks/4.2.1-review-fixes/`
  - [ ] Task 4.3: Undo Auto-Corrections — Let the user undo/review auto-corrections — deferred (user decision 2026-10-22) — implementation details on `.specs/features/04-preview-area-auto-fix/tasks/4.3-undo-auto-corrections/`

- [ ] **Feature 5: ActionsBar Extensions** — Additional action buttons on the MergeSession ActionsBar
  - [x] Task 5.1: Return Button — Replace "Start Merge" with "Return" after merge starts — implementation details on `.specs/features/05-actions-bar-extensions/tasks/5.1-return-button/`
  - [ ] Task 5.2: "Start Over" Button — Reset page without reload (to be planned later)
  - [ ] Task 5.3: "Add Text" Button — Add new text input, up to 4 total (to be planned later)

- [ ] **Feature 6: UI/UX Adjustments** — Minor improvements to polish user experience
  - [x] Task 6.1: Styling Adjustments — Visual polish and consistency — implemented (no separate .specs folder)
  - [x] Task 6.2: Animations — Subtle motion for better perceived performance — implemented (no separate .specs folder)
  - [x] Task 6.3: Tools Adjustments — Refine existing tool behavior — implementation details on `.specs/features/06-ui-ux-adjustments/tasks/6.3-tools-adjustments/`
  - [x] Task 6.4: Platform Adjustments — Cross-platform/browser consistency — implementation details on `.specs/features/06-ui-adjustments/tasks/6.4-platform-adjustments/`
  - [x] Task 6.5: Security Hardening — Front-end security improvements — implementation details on `.specs/features/06-ui-ux-adjustments/tasks/6.5-security-hardening/`

### v1: "Merges" CRUD

- Description: The user must log in and navigate to a sessions screen, where they can start a new merge session or return to an existing one. Additional tools may also be added to the text preview interface. Routing details to be defined.
- Status: To be started

### v2: AI Integration

- Description: The user can choose between manual input (the current setup) or model output. Selecting model output will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions.
- Status: To be started