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
   * Optional class name applied to the root element
   */
  className?: string;
}
