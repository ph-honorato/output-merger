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

export interface MoveSnippetAction {
  type: 'MOVE_SNIPPET';
  // 0-based index into the merge-ordered state array the move starts from
  fromIndex: number;
  // 0-based index into the merge-ordered state array the move ends at
  toIndex: number;
}

export type SnippetsAction = SetSourceSnippetsAction | MoveSnippetAction;

export interface SnippetsContextValue {
  // All snippets across sources, always sorted by merge order
  snippets: SnippetsState;
  // Replaces the snippets recorded for one source (full-array reconciliation)
  setSourceSnippets: (sourceId: string, snippets: Snippet[]) => void;
  // Moves a snippet within the global merge sequence (0-based indexes),
  // renumbering the sequence to a dense 1..n
  moveSnippet: (fromIndex: number, toIndex: number) => void;
}
