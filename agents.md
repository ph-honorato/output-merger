# Agents Guidelines for Output Merger Project

This document serves as a guideline for AI agents working on the Output Merger project. It defines the rules, conventions, and structure that agents should follow when implementing features.

## Project Context

**Output Merger** is an AI Output Comparison Platform that allows users to compare and merge AI-generated outputs with live preview.

### Project Structure
- **Frontend**: `artifacts/output-merger.UI` - Vite + React + TypeScript application
- **Backend**: `artifacts/output-merger.API` - Future Nest.js implementation (planned for V1)

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: MUI and Styled Components
- **Design System**: Guided by `design.md` (to be created)
- **Testing**: Vitest
- **State Management**: React Context + useReducer (current), potentially evolving

## Implementation Rules

### Folder-Specific Implementation
- **Frontend/Interface Changes**: All modifications must be made exclusively in the `artifacts/output-merger.UI` folder
- **Backend/API Changes**: All modifications must be made exclusively in the `artifacts/output-merger.API` folder

### Component Development (Frontend)
Whenever there is a necessity to implement a component for the UI:
1. Create a sub-agent for that component to save context
2. Place the component in the `artifacts/output-merger.UI/src/components` folder
3. The components folder should have an alias configured to be called globally via `@components`
4. Every component should be implemented following the `components/Example` template (to be established)

### Testing
- All tests should be implemented using Vitest
- **Features should only have integration tests** - test complete user workflows and interactions
- **Unit tests should only be implemented on:**
  - UI components (in `src/components`)
  - Future API functions (in `artifacts/output-merger.API`)
- Test files should be placed alongside the implementation files or in a `__tests__` directory following Vitest conventions

## Current Status (V0 - MVP)
As described in README.md:
- Users can add up to 3 different texts and start a merge session
- Users can select text parts with the mouse to auto-include in the preview
- In the preview area, users can drag highlighted text snippets, create line breaks, split snippets between words, and add own text
- Status: Started

## Planned Features

### V1 ("Merges" CRUD)
- User authentication and login requirement
- Sessions screen to start new merge sessions or return to existing ones
- Additional tools may be added to the text preview interface
- Backend API implementation (Nest.js) for session persistence

### V2 (AI Integration)
- Option to choose between manual input or model output
- Screen to integrate with desired AI models alongside entered prompts
- Ability to reuse prompts from previous inputs via "copy from…" functionality
- Generated prompt outputs made available for merging as in previous versions

## Agent Workflow Guidelines

When working on this project, agents should:
1. First understand the current feature or bug being addressed
2. Check if similar implementations exist in the codebase for reference
3. Follow the established patterns and conventions
4. Create focused, single-purpose components when implementing UI elements
5. Ensure proper separation of concerns between frontend and backend
6. Write tests for new functionality
7. Update documentation when necessary

## Component Template Reference
When creating new components, agents should follow this structure (to be created in `src/components/Example/`):
- Component file (.tsx)
- Styles file (.module.css or styled components)
- Index file for export
- Test file (.test.tsx)
- Any necessary hooks or utilities in subfolders

This guideline will evolve as the project develops and more specific patterns are established.