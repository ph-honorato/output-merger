# Agents Guidelines for Output Merger Project

**Project Context**: See [context.md](./context.md) for project overview, technology stack, routing, and planned features.

## Implementation Rules

### Folder-Specific Implementation

- **Frontend/Interface Changes**: All modifications must be made exclusively in the `artifacts/output-merger.UI` folder
- **Backend/API Changes**: All modifications must be made exclusively in the `artifacts/output-merger.API` folder

### Component Development (Frontend)

Whenever there is a necessity to implement a component for the UI:

1. Create a sub-agent for that component to save context
2. Place the component in the `artifacts/output-merger.UI/src/components` folder
3. The components folder should have an alias configured to be called globally via `@components`
4. When creating new components, agents should follow this structure (example in `components/Example/`):

```
Example.tsx           // Component implementation file
Example.hook.tsx      // Hooks implementation file
Example.test.tsx      // Unit tests implementation file
Example.styles.ts     // Styled-components file
Example.types.ts      // Component's interface and types implementation file
index.ts              // Index file to export
```

### Routing (Frontend)

When adding new routes to the application:

1. Create the page component in `src/pages/` following the component structure
2. Add the route to `src/routes/routeTree.gen.ts`:
   - Import the page component
   - Create a route using `createRoute` with path and component
   - Add the route to the route tree in `rootRoute.addChildren([...])`
   - For redirects, use `beforeLoad` with `{ redirect: '/target-path' }`
3. Update the routes documentation in `context.md` with the new route
4. Add translations for any new text in the page component

### Internationalization/Localization

- Agents must always add texts to translation files (en-US and pt-BR) when adding texts to the front-end
- Translation files are be located in `src/i18n/resources/` with separate files for each language
- Use React-i18next or similar library for translation implementation

### Agent Workflow Guidelines

When working on this project, agents should:

1. First understand the current feature or bug being addressed
2. Check if similar implementations exist in the codebase for reference
3. Follow the established patterns and conventions
4. Create focused, single-purpose components when implementing UI elements
5. Ensure proper separation of concerns between frontend and backend
6. Write tests for new functionality
7. Update documentation when necessary
8. After a feature is implementad, go back to [roadmap.md](./roadmap.md) and update the status
9. If there's a big decision is needed, ask before implementing!

## Implementation Guidelines

| Guideline             | Description                                                                                                                                                                            | Applies To                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Styling**           | Implement styling using MUI and Styled Components consistently across all components                                                                                                   | All UI components                      |
| **State Management**  | Implement state management using React Context + useReducer for global state                                                                                                           | All features requiring shared state    |
| **Integration Tests** | Write integration tests for key user workflows using Vitest. Test files should be placed alongside the implementation files or in a `__tests__` directory following Vitest conventions | All features (complete user workflows) |
| **Unit Tests**        | Implement unit tests only for UI components (in `src/components`) and future API functions (in `artifacts/output-merger.API`)                                                          | Components and API functions only      |
