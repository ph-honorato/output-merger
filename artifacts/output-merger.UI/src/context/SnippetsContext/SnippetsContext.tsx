import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { i18n } from '@translation';
import { initialSnippetsState, snippetsReducer } from './SnippetsContext.reducer';
import { SnippetsContext } from './SnippetsContext.hook';
import type { SnippetsContextValue } from './SnippetsContext.types';

export function SnippetsProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(snippetsReducer, initialSnippetsState);

  // i18n owns the language; the store mirrors it so every case-fix
  // derivation (document transitions and the copy path) reads one
  // field. A runtime switch dispatches through the reducer, which
  // re-derives the document casing under the new language.
  useEffect(() => {
    const syncCaseFixLanguage = (language: string) => {
      dispatch({ type: 'SET_CASE_FIX_LANGUAGE', language });
    };
    i18n.on('languageChanged', syncCaseFixLanguage);
    return () => {
      i18n.off('languageChanged', syncCaseFixLanguage);
    };
  }, []);

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

  const moveTokenToLanding = useCallback<
    SnippetsContextValue['moveTokenToLanding']
  >((fromIndex, landing) => {
    dispatch({ type: 'MOVE_TOKEN_TO_LANDING', fromIndex, landing });
  }, []);

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
      caseFixLanguage: state.caseFixLanguage,
      setSourceSnippets,
      moveToken,
      moveTokenToLanding,
      syncDocument,
      setEditEnabled,
    }),
    [state, setSourceSnippets, moveToken, moveTokenToLanding, syncDocument, setEditEnabled]
  );

  return (
    <SnippetsContext.Provider value={value}>
      {children}
    </SnippetsContext.Provider>
  );
}
