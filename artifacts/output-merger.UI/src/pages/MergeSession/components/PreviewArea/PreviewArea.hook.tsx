import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  ScreenReaderInstructions,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSnippets } from '../../../../context/SnippetsContext';
import type { OrderedSnippet } from '../../../../context/SnippetsContext';

/**
 * PointerSensor hold-to-drag activation (ADR 0002): the drag starts only
 * when the pointer is held for the delay while moving at most the
 * tolerance — a plain click never starts a drag. Tuning these values is a
 * feel change, not a contract change.
 */
export const SNIPPET_DRAG_ACTIVATION = { delay: 50, tolerance: 5 } as const;

/**
 * Composite sortable id for a merge-ordered snippet: `${sourceId}:${id}`.
 * Ids are unique within a source only (the reducer tolerates cross-source
 * id collisions), so bare ids cannot key sortable items.
 */
export const buildSortableId = (snippet: OrderedSnippet): string =>
  `${snippet.sourceId}:${snippet.id}`;

/**
 * Landing slot of the dragged snippet, as a gap in the CURRENT render
 * order (0..n — the dragged chip still renders at its origin slot), or
 * null while the drop-indicator needle is hidden. Moving forward lands
 * the needle AFTER the hovered snippet, moving backward BEFORE it, and
 * hovering the dragged snippet itself (including the pickup instant)
 * lands at the origin slot — the gap moveSnippet(fromIndex, overIndex)
 * drops the chip into (splice out at from, re-insert at over), so the
 * needle can never contradict the drop outcome. A null target or an
 * unresolved index (-1: the snippet vanished mid-drag) hides the needle.
 */
export const computeNeedleIndex = (
  fromIndex: number,
  overIndex: number | null
): number | null => {
  if (overIndex === null || fromIndex < 0 || overIndex < 0) {
    return null;
  }
  return fromIndex < overIndex ? overIndex + 1 : overIndex;
};

const SORTING_KEYS = {
  instructions: 'pages.mergeSession.previewArea.sorting.instructions',
  started: 'pages.mergeSession.previewArea.sorting.started',
  over: 'pages.mergeSession.previewArea.sorting.over',
  ended: 'pages.mergeSession.previewArea.sorting.ended',
  cancelled: 'pages.mergeSession.previewArea.sorting.cancelled',
} as const;

/**
 * Composes i18n, the global merge-ordered snippets list, and this
 * PreviewArea instance's drag-sorting wiring (sensors, announcements,
 * and drag lifecycle handlers).
 */
export function usePreviewArea() {
  const { t } = useTranslation();
  const { snippets, moveSnippet } = useSnippets();

  const sortableIds = useMemo(() => snippets.map(buildSortableId), [snippets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SNIPPET_DRAG_ACTIVATION,
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeSnippet, setActiveSnippet] = useState<OrderedSnippet | null>(null);
  // Insertion slot of the drop-indicator needle; null keeps it hidden
  // (no active drag, or no target resolves).
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
    null
  );

  const indexOfSortableId = useCallback(
    (id: string) =>
      snippets.findIndex((snippet) => buildSortableId(snippet) === id),
    [snippets]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const index = indexOfSortableId(String(event.active.id));
      setActiveSnippet(index >= 0 ? snippets[index] : null);
      // Pickup resolves to the dragged item itself: the needle starts
      // at the origin slot.
      setDropIndicatorIndex(index >= 0 ? index : null);
    },
    [indexOfSortableId, snippets]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      const fromIndex = indexOfSortableId(String(active.id));
      const overIndex = over ? indexOfSortableId(String(over.id)) : null;
      setDropIndicatorIndex(computeNeedleIndex(fromIndex, overIndex));
    },
    [indexOfSortableId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveSnippet(null);
      setDropIndicatorIndex(null);
      const { active, over } = event;

      if (!over || active.id === over.id) {
        // Released on the item's own position or with no target: the
        // merge order stays unchanged.
        return;
      }

      const fromIndex = indexOfSortableId(String(active.id));
      const toIndex = indexOfSortableId(String(over.id));

      if (fromIndex < 0 || toIndex < 0) {
        // The dragged snippet vanished mid-drag: discard the reorder.
        return;
      }

      moveSnippet(fromIndex, toIndex);
    },
    [indexOfSortableId, moveSnippet]
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveSnippet(null);
    setDropIndicatorIndex(null);
  }, []);

  const announcements = useMemo<Announcements>(() => {
    // Positions-only announcements: 1-based, no snippet text.
    const describePosition = (key: string, id: string) => {
      const index = indexOfSortableId(id);
      return index >= 0
        ? t(key, { index: index + 1, count: snippets.length })
        : undefined;
    };

    return {
      onDragStart: ({ active }) =>
        describePosition(SORTING_KEYS.started, String(active.id)),
      onDragOver: ({ active, over }) =>
        over && over.id !== active.id
          ? describePosition(SORTING_KEYS.over, String(over.id))
          : undefined,
      onDragEnd: ({ over }) =>
        over
          ? describePosition(SORTING_KEYS.ended, String(over.id))
          : t(SORTING_KEYS.cancelled),
      onDragCancel: () => t(SORTING_KEYS.cancelled),
    };
  }, [t, indexOfSortableId, snippets]);

  const screenReaderInstructions = useMemo<ScreenReaderInstructions>(
    () => ({ draggable: t(SORTING_KEYS.instructions) }),
    [t]
  );

  return {
    t,
    snippets,
    sortableIds,
    sensors,
    announcements,
    screenReaderInstructions,
    activeSnippet,
    dropIndicatorIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragCancel,
  };
}
