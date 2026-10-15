# Output Merger

AI Output Comparison Platform - Compare and merge AI-generated outputs with live preview.

## Project Structure

```
/artifacts
  /output-merger.UI    # Vite + React + TypeScript frontend
  /output-merger.API   # Backend API (future implementation)
```

## Roadmap

**V0 (MVP):** The user can add up to 3 different texts and start the merge session. The user can select text parts with the mouse to auto-include in the preview. At the preview area, the user can then drag previously highlighted text snippets, create line breaks, split highlighted snippets between words and add own text. **Status: started**

**V1 ("Merges" CRUD):** The user must log in and navigate to a sessions screen, where they can start a new "merge" session or return to an existing one. Additional tools may also be added to the text preview interface. **Status: to be started**

**V2 (AI Integration):** The user can choose between manual or model input. Selecting model input will open a screen to integrate with the desired model alongside the entered prompt. If the user wants to use the same setup for the second entry, they can reuse a prompt from a previous input by selecting "copy from…". Once the merge starts, the generated prompt outputs will be made available as in previous versions. **Status: to be started**

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: styled-components + MUI
- **State Management**: React Context + useReducer
- **AI Agent**: Opencode
