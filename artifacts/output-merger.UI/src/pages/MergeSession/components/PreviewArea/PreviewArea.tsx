import PreviewIcon from '@mui/icons-material/Preview';
import { Fragment } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableSegment } from '../';
import { buildGapId, usePreviewArea } from './PreviewArea.hook';
import { withAlpha } from '../../../../utils/color';
import type { PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

/**
 * Invisible zero-footprint droppable for one insertion gap
 * (before/between/after the snippets). While a pointer drag hovers
 * the space between two snippets, dnd-kit reports this anchor as
 * `over`, so the needle renders at that slot and the drop lands
 * exactly there. Decorative collision anchor only: hidden from
 * assistive tech, no text, no layout footprint.
 */
function DropGap({ slot }: { slot: number }) {
  const { setNodeRef } = useDroppable({ id: buildGapId(slot) });
  return (
    <S.DropGap
      ref={setNodeRef}
      data-testid="preview-drop-gap"
      data-gap-slot={slot}
      aria-hidden="true"
    />
  );
}

function PreviewArea(props: PreviewAreaProps) {
  const { className } = props;
  const {
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
  } = usePreviewArea();

  // The needle renders exactly once, at the dragged snippet's landing
  // slot: right after the snippet that precedes the slot (so it stays
  // on the earlier line at a wrap boundary), before the separator of
  // the snippet currently occupying the slot, or after the last
  // snippet for the trailing slot. Decorative: no text, hidden from
  // assistive tech (the sorting.* announcements cover non-visual
  // feedback).
  const renderDropIndicator = (slot: number) =>
    dropIndicatorIndex === slot ? (
      <S.DropIndicator data-testid="preview-drop-indicator" aria-hidden="true">
        <S.DropIndicatorBar />
      </S.DropIndicator>
    ) : null;

  return (
    <S.PreviewAreaRoot data-testid="preview-area" className={className}>
      {snippets.length === 0 ? (
        <S.EmptyState data-testid="preview-empty">
          <PreviewIcon aria-hidden="true" />
          <span>{t('pages.mergeSession.previewArea.empty')}</span>
        </S.EmptyState>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements, screenReaderInstructions }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <S.SegmentFlow data-testid="preview-segment-flow">
              {snippets.map((snippet, index) => (
                <Fragment key={sortableIds[index]}>
                  <DropGap slot={index} />
                  {renderDropIndicator(index)}
                  {index > 0 ? ' ' : null}
                  <SortableSegment
                    snippet={snippet}
                    sortableId={sortableIds[index]}
                  />
                </Fragment>
              ))}
              <DropGap slot={snippets.length} />
              {renderDropIndicator(snippets.length)}
            </S.SegmentFlow>
          </SortableContext>
          <DragOverlay zIndex={200} dropAnimation={null}>
            {activeSnippet ? (
              <S.OverlayChip
                data-testid="preview-snippet-overlay"
                style={{
                  backgroundColor: withAlpha(activeSnippet.color, 0.3),
                }}
              >
                {activeSnippet.text}
              </S.OverlayChip>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </S.PreviewAreaRoot>
  );
}

export default PreviewArea;
