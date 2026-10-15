import { useSortable } from '@dnd-kit/sortable';

/**
 * Wires one merge-ordered snippet into the preview's sortable flow:
 * dnd-kit's default sortable attributes/listeners, the combined node
 * ref, and the in-place drag transform/transition.
 */
export function useSortableSegment(sortableId: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id: sortableId });

  return { attributes, isDragging, listeners, setNodeRef, transform, transition };
}
