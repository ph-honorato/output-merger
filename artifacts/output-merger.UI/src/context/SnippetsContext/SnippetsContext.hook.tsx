import { createContext, useContext } from 'react';
import type { SnippetsContextValue } from './SnippetsContext.types';

export const SnippetsContext = createContext<SnippetsContextValue | null>(null);

/**
 * Consumes the global snippets context: the merge-ordered snippet list
 * and the per-source setter. Throws outside a SnippetsProvider.
 */
export function useSnippets(): SnippetsContextValue {
  const context = useContext(SnippetsContext);
  if (!context) {
    throw new Error('useSnippets must be used within a SnippetsProvider');
  }
  return context;
}
