# Output Merger UI

Frontend application for the Output Merger platform — an AI Output Comparison Platform that allows users to compare and merge AI-generated outputs with live preview.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Routing**: TanStack Router
- **Styling**: MUI (Material UI) + styled-components
- **State Management**: React Context + useReducer
- **Internationalization**: i18next + react-i18next (en-US, pt-BR)
- **Testing**: Vitest + React Testing Library
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Security**: DOMPurify, CSP, Trusted Types

## Project Structure

```
artifacts/output-merger.UI/
├── src/
│   ├── components/       # Global reusable components (Header, TextInput, ActionsBar, etc.)
│   ├── context/          # React Context providers (SnippetsContext, ThemeContext)
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Internationalization (translations, language switching)
│   ├── pages/            # Page components (MergeSession page with its own components)
│   ├── routes/           # TanStack Router route definitions
│   ├── theme/            # MUI theme (light/dark) + design tokens
│   ├── utils/            # Utility functions (sanitization, preview document, animations, etc.)
│   ├── App.tsx           # Root app component
│   └── main.tsx          # Entry point
├── public/               # Static assets (logo, etc.)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build (tsc + vite build)
npm run lint      # Run oxlint
npm run preview   # Preview production build
npm run test      # Run Vitest tests
```

## Key Features (V0 - MVP)

- **Text Inputs**: 2 sources with needle-based word-aligned snippet selection (max 500 chars each)
- **Preview Area**: Live merged preview with drag-and-drop reordering (@dnd-kit)
- **Preview Modal**: Full-screen modal view of the same preview area
- **Editable Preview**: Inline and modal editing of merged text (own text, line breaks)
- **Auto-fix**: Automatic case correction (sentence start/mid-sentence) and spacing normalization
- **Dark Mode**: Full light/dark theme support with persistence
- **Internationalization**: English (US) and Portuguese (BR) translations
- **Security**: XSS prevention via DOMPurify, CSP headers, Trusted Types, secure clipboard API

## Design System

Guided by [`design.md`](../../design.md) at the project root. Theme tokens defined in `src/theme/index.ts`.

## Routing

Single route for MVP:
- `/` → MergeSessionPage

Future routes (V1) to be defined.

## Translation

Add new texts to both `src/i18n/resources/en-US.json` and `src/i18n/resources/pt-BR.json`. Import via `@translation` alias:

```typescript
import { i18n, enUS, ptBR } from "@translation";
```

## Component Structure Convention

Each component follows this structure:

```
ComponentName/
├── ComponentName.tsx         # Component implementation
├── ComponentName.hook.tsx    # Custom hooks
├── ComponentName.test.tsx    # Unit tests
├── ComponentName.styles.ts   # styled-components
├── ComponentName.types.ts    # TypeScript interfaces
└── index.ts                  # Barrel export
```

Global components exported from `src/components/index.ts` via `@components` alias.
Page-specific components exported from their page's `components/index.ts`.