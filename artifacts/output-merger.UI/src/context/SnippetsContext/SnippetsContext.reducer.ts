import type { OrderedSnippet, SnippetsAction, SnippetsState } from './SnippetsContext.types';

export const snippetsReducer = (
  state: SnippetsState,
  action: SnippetsAction
): SnippetsState => {
  switch (action.type) {
    case 'SET_SOURCE_SNIPPETS': {
      const { sourceId, snippets } = action;

      const previousById = new Map(
        state
          .filter((entry) => entry.sourceId === sourceId)
          .map((entry) => [entry.id, entry] as const)
      );

      let nextOrder = state.reduce(
        (max, entry) => Math.max(max, entry.order),
        0
      );

      const reconciled = snippets.map((snippet): OrderedSnippet => {
        const existing = previousById.get(snippet.id);
        if (existing) {
          return { ...snippet, sourceId, order: existing.order };
        }
        nextOrder += 1;
        return { ...snippet, sourceId, order: nextOrder };
      });

      const others = state.filter((entry) => entry.sourceId !== sourceId);

      return [...others, ...reconciled].sort((a, b) => a.order - b.order);
    }
    case 'MOVE_SNIPPET': {
      const { fromIndex, toIndex } = action;
      const inBounds = (index: number) => index >= 0 && index < state.length;

      if (fromIndex === toIndex || !inBounds(fromIndex) || !inBounds(toIndex)) {
        return state;
      }

      const next = [...state];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      // Sole sanctioned renumbering writer (ADR 0001): an explicit user
      // reorder renumbers the whole sequence to a dense 1..n.
      return next.map((entry, index) => ({ ...entry, order: index + 1 }));
    }
    default:
      return state;
  }
};
