# Project Context - Output Merger

This document contains the project context, technology stack, and architectural decisions for the Output Merger project.

## Project Overview

**Output Merger** is an AI Output Comparison Platform that allows users to compare and merge AI-generated outputs with live preview.

## Project Structure

- **Frontend**: `artifacts/output-merger.UI` - Vite + React + TypeScript application
- **Backend**: `artifacts/output-merger.API` - Future Nest.js implementation (planned for V1)

## Routing Behavior

The application uses Tanstack Router for routing.

### Routes

#### MVP (v0):
- `"{base_url}/quickMerge"` -> Merge Session Page (always redirect this router when user enters the app)

#### V1:
- `"{base_url}"` -> Landing page with login
- `"{base_url}/login"` -> Login Page
- `"{base_url}/sessions"` -> Sessions Page (accessed after user authentication)
- `"{base_url}/sessions/{merge_session_id}"` -> Merge Session Page (MVP implementation but with persisted information from user)

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Routing**: Tanstack Router
- **Styling**: MUI and Styled Components
- **Design System**: Guided by `design.md` (to be created)
- **Testing**: Vitest
- **State Management**: React Context + useReducer (current), potentially evolving

## Current Status (V0 - MVP)

As described in README.md:
- Users can add up to 3 different texts and start a merge session
- Users can select text parts with the mouse to auto-include in the preview
- In the preview area, users can drag highlighted text snippets, create line breaks, split snippets between words, and add own text
- Status: In Progress

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