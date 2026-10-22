import type { SnippetToken } from '../../../../context/SnippetsContext';

/**
 * Props for the SortableSegment component
 * @interface SortableSegmentProps
 */
export interface SortableSegmentProps {
  /**
   * The merge-ordered snippet token rendered by this segment — its
   * tokenId is the sortable id and the parser's data-token-id key
   */
  token: SnippetToken;
  /**
   * while true (edit mode ON)
   * the chip renders as a plain span of the editor — no focus/a11y
   * attributes, text cursor, text selection — while the node ref and
   * the keyboard activator listener stay attached (the Ctrl+Space
   * entry). Default false (edit mode OFF: full dnd-kit semantics).
   */
  editing?: boolean;
  /**
   * Optional class name applied to the root element
   */
  className?: string;
}
