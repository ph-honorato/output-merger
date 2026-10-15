import PreviewIcon from '@mui/icons-material/Preview';
import { Fragment } from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableSegment } from '../';
import { usePreviewArea } from './PreviewArea.hook';
import { withAlpha } from '../../../../utils/color';
import type { PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

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
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = usePreviewArea();

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
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <S.SegmentFlow data-testid="preview-segment-flow">
              {snippets.map((snippet, index) => (
                <Fragment key={sortableIds[index]}>
                  {index > 0 ? ' ' : null}
                  <SortableSegment
                    snippet={snippet}
                    sortableId={sortableIds[index]}
                  />
                </Fragment>
              ))}
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
