# Output Merger

AI Output Comparison Platform - Compare and merge AI-generated outputs with live preview.

## Current Implementation

The user can add up to 2 different texts and start a merge session. The user can select text parts with the mouse to auto-include in the preview. The preview area, has the following features:

- Drag and drop to reorder highlighted text snippets (ctrl + space on edit mode)
- Edit mode, where is possible to edit snippets and add own text directly in the preview
- Open a full-screen modal for a larger preview
- Auto-fix snippet casing (sentence start/mid-sentence)
- Auto-fix spacing around punctuation
- Copy button the merged text to clipboard
- Keyboard shortcuts to main features

Availabe in both English (US) and Portuguese (BR), with a dark mode option (of course).

## Future Versions

### V0 (MVP)

There are planned features to be implemented on MVP before moving to next phase like support for more 6 text inputs.

**Status: In Progress**

### V1 ("Merges" CRUD)

The user must log in and navigate to a merge sessions screen, where they can start a new merge session or return to an existing one. Additional tools may also be added to the text preview interface.

**Status: To be started**

### V2 (AI Integration)

The user can choose between manual or model input. Selecting model input will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions.

**Status: To be started**

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: TanStack Router
- **Styling**: MUI (Material UI) + styled-components
- **State Management**: React Context + useReducer
- **Testing**: Vitest + React Testing Library
