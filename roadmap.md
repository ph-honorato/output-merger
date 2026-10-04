# Roadmap

## Epics

### v0: Minimum Viable Product (MVP)
- Description: The user can add up to 3 different texts and start the merge session. The user can select text parts with the mouse to auto-include in the preview. At the preview area, the user can then drag previously highlighted text snippets, create line breaks, split highlighted snippets between words and add own text. Routing will be handled by Tanstack Router, with the Merge Session page at "{base_url}/". Includes translations for en-US and pt-BR.
- Status: In Progress

#### Features for v0
- [x] **Feature 1: Project Setup & Foundation** - Set up the complete project foundation including project structure, styling, routing, and base components
  - [x] Set up the project structure (frontend with Vite, React, TypeScript)
  - [x] Set-up styled-components and MUI
  - [x] Create Header component with the name of the project on the left (should be responsive)
  - [x] Set up translation for en-US and pt-BR (There is already a basic implementation and translation files). And add a translation button on the Header component.
  - [x] Install and set-up tanstack react router. 
  - [x] Create a "MergeSession" Page. It should be empty by now, just follow the design.md patterns. Set-up "/" in react router for this Page.
- [ ] **Feature 2: Text Merging** - Core text merging functionality
  - [ ] Implement text input component (it should have 2 states - 1: normal input; 2: read-only) max 2.5k chars by now
  - [ ] Add two text inputs on MergeSession Page
  - [ ] Add a bar over all the inputs that holds the "start merge" button
  - [ ] Add a preview area (just the component, no tools from feature 5 yet) should be on right side of input components
  - [ ] Implement text selection on components. After "start merge", the text-inputs should be read-only. And when user selects a text part with mouse, the selected text should be displayed on the preview area (also read-only by now).
- [ ] **Feature 3: Third Text Input** - Add support for a third text input
  - [ ] Add a button to add a third text input on MergeSession Page
  - [ ] Implement logic to handle three text inputs in the merge session
- [ ] **Feature 4: Preview Area Tools** - Implement the preview area with:
  - Sort highlighted text snippets by drag
  - Creating line breaks
  - Splitting snippets between words
  - Adding own text
- [ ] **Feature 5: Release Preparation** - Finalize and prepare for release

### v1: "Merges" CRUD
- Description: The user must log in and navigate to a sessions screen, where they can start a new "merge" session or return to an existing one. Additional tools may also be added to the text preview interface. Routing will support "{base_url}/sessions/{merge_session_id}" for accessing different sessions.
- Status: To be started

### v2: AI Integration
- Description: The user can choose between manual input (the current setup) or model output. Selecting model output will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions.
- Status: To be started