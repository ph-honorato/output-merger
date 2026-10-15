import { useCallback, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { snippetsReducer } from './SnippetsContext.reducer';
import { SnippetsContext } from './SnippetsContext.hook';
import type { SnippetsContextValue, SnippetsState } from './SnippetsContext.types';

export function SnippetsProvider({ children }: { children?: ReactNode }) {
  const [snippets, dispatch] = useReducer(
    snippetsReducer,
    [] as SnippetsState
  );

  const setSourceSnippets = useCallback<SnippetsContextValue['setSourceSnippets']>(
    (sourceId, snippets) => {
      dispatch({ type: 'SET_SOURCE_SNIPPETS', sourceId, snippets });
    },
    []
  );

  const moveSnippet = useCallback<SnippetsContextValue['moveSnippet']>(
    (fromIndex, toIndex) => {
      dispatch({ type: 'MOVE_SNIPPET', fromIndex, toIndex });
    },
    []
  );

  const value = useMemo<SnippetsContextValue>(
    () => ({ snippets, setSourceSnippets, moveSnippet }),
    [snippets, setSourceSnippets, moveSnippet]
  );

  return (
    <SnippetsContext.Provider value={value}>
      {children}
    </SnippetsContext.Provider>
  );
}
