# Roadmap

## Epics

### v0: Minimum Viable Product (MVP)
- Description: The user can add up to 3 different texts and start the merge session. The user can select text parts with the mouse to auto-include in the preview. At the preview area, the user can then drag previously highlighted text snippets, create line breaks, split highlighted snippets between words and add own text. Routing will be handled by Tanstack Router, with initial redirect to "{base_url}/quickMerge". Includes translations for en-US and pt-BR.
- Status: In Progress

#### Tasks for v0
- [x] 1. Set up the project structure (frontend with Vite, React, TypeScript)
- [ ] 2. Set-up styled-components and MUI
- [ ] 3. Create Header component with the name of the project on the left (should be responsive)
- [ ] 4. Set up translation for en-US and pt-BR (There is already a basic implementation and translation files). And add a translation button on the Header component.
- [ ] 5. Install and set-up tanstack react router. 
- [ ] 6. Create a "MergeSession" Page. It should be empty by now, just follow the design.md patterns. Set-up "/quickMerge" in react router for this Page. Set-up react router to always redirect user to {base_url}/quickMerge.
- [ ] 7. Implement the UI for adding up to 3 text inputs in the MergeSession page
- [ ] 8. Implement the merge session start functionality
- [ ] 9. Implement text selection (mouse-based) to auto-include in the preview
- [ ] 10. Implement the preview area with:
  - Sort highlighted text snippets by drag
  - Creating line breaks
  - Splitting snippets between words
  - Adding own text
- [ ] 11. Implement styling (using MUI and Styled Components)
- [ ] 12. Implement state management (React Context + useReducer)
- [ ] 13. Write integration tests for the key user workflows (using Vitest)
- [ ] 14. Finalize and prepare for release

### v1: "Merges" CRUD
- Description: The user must log in and navigate to a sessions screen, where they can start a new "merge" session or return to an existing one. Additional tools may also be added to the text preview interface. Routing will support "{base_url}/sessions/{merge_session_id}" for accessing different sessions.
- Status: To be started

### v2: AI Integration
- Description: The user can choose between manual input (the current setup) or model output. Selecting model output will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions.
- Status: To be started