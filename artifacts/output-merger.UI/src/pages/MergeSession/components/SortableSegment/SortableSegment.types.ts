import type { OrderedSnippet } from '../../../../context/SnippetsContext';

/**
 * Props for the SortableSegment component
 * @interface SortableSegmentProps
 */
export interface SortableSegmentProps {
  /**
   * The merge-ordered snippet rendered by this segment
   */
  snippet: OrderedSnippet;
  /**
   * Composite sortable id (`${sourceId}:${id}`) — unique even when
   * snippet ids collide across sources
   */
  sortableId: string;
  /**
   * Optional class name applied to the root element
   */
  className?: string;
}
