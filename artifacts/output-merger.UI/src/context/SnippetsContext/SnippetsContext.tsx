import { useCallback, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { initialSnippetsState, snippetsReducer } from './SnippetsContext.reducer';
import { SnippetsContext } from './SnippetsContext.hook';
import type { SnippetsContextValue } from './SnippetsContext.types';

export function SnippetsProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(snippetsReducer, initialSnippetsState);

  const setSourceSnippets = useCallback<SnippetsContextValue['setSourceSnippets']>(
    (sourceId, snippets) => {
      dispatch({ type: 'SET_SOURCE_SNIPPETS', sourceId, snippets });
    },
    []
  );

  const moveToken = useCallback<SnippetsContextValue['moveToken']>(
    (fromIndex, toIndex) => {
      dispatch({ type: 'MOVE_TOKEN', fromIndex, toIndex });
    },
    []
  );

  const syncDocument = useCallback<SnippetsContextValue['syncDocument']>(
    (tokens) => {
      dispatch({ type: 'SYNC_DOCUMENT', tokens });
    },
    []
  );

  const setEditEnabled = useCallback<SnippetsContextValue['setEditEnabled']>(
    (editEnabled) => {
      dispatch({ type: 'SET_EDIT_ENABLED', editEnabled });
    },
    []
  );

  const value = useMemo<SnippetsContextValue>(
    () => ({
      document: state.tokens,
      editEnabled: state.editEnabled,
      setSourceSnippets,
      moveToken,
      syncDocument,
      setEditEnabled,
    }),
    [state, setSourceSnippets, moveToken, syncDocument, setEditEnabled]
  );

  return (
    <SnippetsContext.Provider value={value}>
      {children}
    </SnippetsContext.Provider>
  );
}
