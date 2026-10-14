import type { Snippet } from '@components';

/**
 * A snippet lifted into the merge sequence: the TextInput snippet plus its
 * source identity and its position in the merge order.
 */
export interface OrderedSnippet extends Snippet {
  // Stable id of the source that emitted this snippet (e.g. "text-1")
  sourceId: string;
  // Position in the merge order; assigned incrementally, gaps allowed
  order: number;
}

export type SnippetsState = OrderedSnippet[];

export interface SetSourceSnippetsAction {
  type: 'SET_SOURCE_SNIPPETS';
  sourceId: string;
  snippets: Snippet[];
}

export type SnippetsAction = SetSourceSnippetsAction;

export interface SnippetsContextValue {
  // All snippets across sources, always sorted by merge order
  snippets: SnippetsState;
  // Replaces the snippets recorded for one source (full-array reconciliation)
  setSourceSnippets: (sourceId: string, snippets: Snippet[]) => void;
}
