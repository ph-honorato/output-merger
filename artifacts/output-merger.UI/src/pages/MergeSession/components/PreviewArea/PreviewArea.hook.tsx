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

/**
 * Droppable id for the insertion gap at `slot` (0..n): the invisible
 * in-flow anchors rendered before/between/after the snippets. While a
 * pointer drag hovers a gap, dnd-kit reports it as `over`, so the
 * needle renders at that slot — the needle then never hides or
 * misplaces while the cursor sits in the space between two snippets.
 */
export const buildGapId = (slot: number): string => `preview-gap:${slot}`;

/**
 * Inverse of buildGapId: the encoded slot, or null for any other id
 * (sortable chips, unresolved targets).
 */
export const parseGapId = (id: string): number | null => {
  const match = /^preview-gap:(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
};

/**
 * moveSnippet target index that drops the dragged snippet at gap
 * `slot`. The reducer splices out at fromIndex, then re-inserts at the
 * target index of the REDUCED array, so slots past the removed chip
 * map one index lower. This mapping is what keeps the needle and the
 * drop outcome identical: the needle renders at `slot` exactly.
 */
export const computeGapMoveIndex = (
  fromIndex: number,
  slot: number
): number => (slot > fromIndex ? slot - 1 : slot);

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
      const overId = over ? String(over.id) : null;
      const gapSlot = overId === null ? null : parseGapId(overId);

      if (gapSlot !== null) {
        // Gap anchors exist for slots 0..snippets.length; a stale
        // slot (the list shrank mid-drag) hides the needle.
        setDropIndicatorIndex(
          gapSlot >= 0 && gapSlot <= snippets.length ? gapSlot : null
        );
        return;
      }

      const overIndex = overId === null ? null : indexOfSortableId(overId);
      setDropIndicatorIndex(computeNeedleIndex(fromIndex, overIndex));
    },
    [indexOfSortableId, snippets.length]
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
      const overId = String(over.id);
      const gapSlot = parseGapId(overId);

      if (gapSlot !== null) {
        // Released over an insertion gap: the chip lands exactly at
        // the slot the needle marked (a stale slot after a mid-drag
        // shrink discards the reorder).
        if (fromIndex < 0 || gapSlot < 0 || gapSlot > snippets.length) {
          return;
        }
        moveSnippet(fromIndex, computeGapMoveIndex(fromIndex, gapSlot));
        return;
      }

      const toIndex = indexOfSortableId(overId);

      if (fromIndex < 0 || toIndex < 0) {
        // The dragged snippet vanished mid-drag: discard the reorder.
        return;
      }

      moveSnippet(fromIndex, toIndex);
    },
    [indexOfSortableId, moveSnippet, snippets.length]
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
      onDragEnd: ({ active, over }) => {
        if (!over) {
          return t(SORTING_KEYS.cancelled);
        }
        const overId = String(over.id);
        const gapSlot = parseGapId(overId);
        if (gapSlot !== null) {
          // Gap drop: announce the landing position — the same
          // move-index identity chip drops use, no new strings.
          const fromIndex = indexOfSortableId(String(active.id));
          return fromIndex >= 0 && gapSlot <= snippets.length
            ? t(SORTING_KEYS.ended, {
                index: computeGapMoveIndex(fromIndex, gapSlot) + 1,
                count: snippets.length,
              })
            : undefined;
        }
        return describePosition(SORTING_KEYS.ended, overId);
      },
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
